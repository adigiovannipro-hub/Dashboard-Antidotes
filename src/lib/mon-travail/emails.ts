import { matchWorkspace, type FathomWorkspace } from "./fathom";

/**
 * Gmail → « Mon travail » : la décision, sans réseau ni base.
 *
 * Même architecture que Fathom : ce qui vient du dehors — les messages —
 * arrive en argument, ce qui doit être écrit repart en valeur de retour.
 *
 * La règle produit est celle de la Modération : **ce qui est lu est traité**.
 * Seuls les messages non lus de la boîte de réception deviennent des tâches ;
 * ouvrir le mail dans Gmail suffit à ce qu'il ne revienne jamais — le filtre
 * `is:unread` est posé à la requête, pas ici. Ici on écarte ce qui n'attend
 * aucune réponse : les expéditeurs automatiques.
 */

export type EmailMessage = {
  /** Identifiant Gmail du message, stable — c'est lui la clé d'idempotence. */
  id: string;
  /** Identifiant du fil, pour le lien profond vers Gmail. */
  threadId: string;
  subject: string | null;
  fromEmail: string;
  fromName: string | null;
};

export type EmailTask = {
  org_id: string;
  workspace_id: string | null;
  title: string;
  source: "email";
  due_date: string;
  dedupe_key: string;
  source_url: string | null;
  source_label: string;
};

export type EmailSkipReason = "automatique" | "sans-objet";

export const EMAIL_SKIP_LABELS: Record<EmailSkipReason, string> = {
  automatique: "messages automatiques (no-reply, notifications)",
  "sans-objet": "messages sans objet",
};

export type EmailPlan = {
  tasks: EmailTask[];
  skipped: Record<EmailSkipReason, number>;
  /** Messages dont aucun client n'a pu être déduit, pour le rapport. */
  withoutClient: string[];
};

/**
 * Un expéditeur qui n'attend pas de réponse ne crée pas de travail.
 *
 * La liste est courte à dessein : un faux positif fait manquer un mail d'un
 * humain, un faux négatif ajoute une ligne qu'on archive d'un geste. Le coût
 * n'est pas symétrique, donc on n'écarte que l'évidence.
 */
const AUTOMATED_SENDER = /no-?reply|do-?not-?reply|notification|newsletter|mailer-daemon|postmaster|bounce/i;

export function isAutomatedSender(email: string): boolean {
  return AUTOMATED_SENDER.test(email);
}

/** Le lien profond vers le fil dans Gmail — ce qu'on vient chercher au clic. */
export function gmailThreadUrl(threadId: string): string {
  return `https://mail.google.com/mail/u/0/#inbox/${threadId}`;
}

export type EmailContext = {
  orgId: string;
  today: string;
  messages: EmailMessage[];
  workspaces: FathomWorkspace[];
};

export function planEmailTasks(context: EmailContext): EmailPlan {
  const tasks: EmailTask[] = [];
  const skipped: Record<EmailSkipReason, number> = {
    automatique: 0,
    "sans-objet": 0,
  };
  const withoutClient = new Set<string>();

  for (const message of context.messages) {
    if (isAutomatedSender(message.fromEmail)) {
      skipped.automatique += 1;
      continue;
    }
    const subject = message.subject?.trim();
    if (!subject) {
      skipped["sans-objet"] += 1;
      continue;
    }

    const sender = message.fromName?.trim() || message.fromEmail;
    // Le client se cherche dans l'objet ET le nom d'expéditeur : « Claire »
    // n'est dans aucun titre, mais « Re: Shooting Bondet » ou une adresse
    // @bondet.fr suffisent — au moindre doute, aucun client, comme Fathom.
    const workspace = matchWorkspace(
      `${subject} ${sender} ${message.fromEmail}`,
      context.workspaces,
    );

    tasks.push({
      org_id: context.orgId,
      workspace_id: workspace?.id ?? null,
      title: `Répondre à ${sender} — ${subject}`,
      source: "email",
      due_date: context.today,
      dedupe_key: `email:${message.id}`,
      source_url: gmailThreadUrl(message.threadId),
      source_label: `Mail — « ${subject} »`,
    });

    if (!workspace) withoutClient.add(subject);
  }

  return { tasks, skipped, withoutClient: [...withoutClient] };
}
