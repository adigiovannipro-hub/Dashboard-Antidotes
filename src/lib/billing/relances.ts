/**
 * Qui reçoit quoi, aujourd'hui — la décision, et rien d'autre.
 *
 * Fonction **pure**, zéro import Supabase : l'état entre en paramètres, la
 * décision sort en valeur de retour. Même doctrine que
 * `src/lib/recus/auto-forward.ts`, et pour la même raison — un automate qui
 * envoie des mails à des clients doit pouvoir être interrogé sur pièce, sans
 * base ni réseau, sur des dizaines de situations en quelques millisecondes.
 *
 * La cadence, décidée le 03/09/2026 :
 *
 *   émission ─── envoi ───J+31─── relance 1 ───J+15─── relance 2 ───J+15─── relance 3 ─── plus rien
 *
 * Les jours se comptent **depuis l'envoi initial** et non depuis l'échéance :
 * c'est la date à laquelle le client a reçu la facture qui fait foi, la seule
 * dont on soit certain. Après la troisième relance, plus rien ne part tout
 * seul — un impayé qui a résisté à trois mails se règle au téléphone.
 *
 * Un règlement arrête tout, à n'importe quel moment : c'est la première
 * question posée, avant même de regarder le calendrier.
 */

import type { BillingEmailKind } from "./types";

/** Jours après l'envoi initial. La relance 1 attend qu'une échéance à 30
    jours soit franchement dépassée ; les suivantes tombent tous les 15. */
export const REMINDER_SCHEDULE: { kind: BillingEmailKind; afterDays: number }[] = [
  { kind: "reminder_1", afterDays: 31 },
  { kind: "reminder_2", afterDays: 46 },
  { kind: "reminder_3", afterDays: 61 },
];

/**
 * Pourquoi rien ne part. Chaque valeur est doublée d'un libellé français :
 * c'est ce que l'écran affiche, et ce que le passage journalise.
 */
export type EnvoiRefusal =
  | "annulee"
  | "deja_payee"
  | "pas_encore_echue"
  | "sans_destinataire"
  | "envoyee_relance_a_venir"
  | "relances_epuisees"
  | "pas_encore_l_heure";

export const REFUSAL_LABELS: Record<EnvoiRefusal, string> = {
  annulee: "Mensualité annulée : rien à facturer.",
  deja_payee: "Facture réglée : plus aucune relance.",
  pas_encore_echue: "Le mois de prestation n'est pas terminé.",
  sans_destinataire: "Aucune adresse de destinataire sur le devis.",
  envoyee_relance_a_venir: "La facture est partie, la première relance viendra.",
  relances_epuisees: "Trois relances envoyées : la suite se règle à la main.",
  pas_encore_l_heure: "La prochaine relance n'est pas encore due.",
};

/**
 * Ce qu'il y a à faire.
 *
 * `emettre` et `envoyer` diffèrent par un point qui compte : la première crée
 * la facture chez Airwallex avant de l'envoyer, la seconde se contente
 * d'envoyer une facture qui existe déjà — celle qu'on a créée à la main, ou
 * celle d'un passage précédent qui avait planté après la création.
 */
export type EnvoiDecision =
  | { action: "emettre"; kind: "invoice" }
  | { action: "envoyer"; kind: BillingEmailKind }
  | { action: "rien"; reason: EnvoiRefusal };

/** Un mail déjà parti, réduit à ce qui sert à décider du suivant. */
export type SentEmail = { kind: BillingEmailKind; sent_at: string };

export type EnvoiContext = {
  /** Statut de la mensualité, tel qu'il est en base. */
  status: "pending" | "issued" | "paid" | "skipped";
  /** Le jour où la facture doit partir — le 1er du mois suivant. */
  issue_on: string;
  /** La facture Airwallex déjà créée pour cette mensualité, si elle existe. */
  airwallex_invoice_id: string | null;
  /** L'adresse du client. Absente : l'automatisme ne s'applique pas. */
  recipient_email: string | null;
  /** Ce qui est déjà parti pour cette mensualité. */
  sent: readonly SentEmail[];
  now: Date;
};

/** Aujourd'hui en UTC, `AAAA-MM-JJ` — même convention que `schedule.ts`. */
function today(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Jours calendaires écoulés depuis un horodatage.
 *
 * En jours et non en heures : un mail parti le 1er à 23 h et une relance
 * calculée le 2 à 1 h ne sont pas séparés d'un jour utile. On compare des
 * dates, comme un humain le ferait sur un calendrier.
 */
export function daysSince(isoTimestamp: string, now: Date): number {
  const sent = new Date(isoTimestamp);
  if (Number.isNaN(sent.getTime())) return 0;
  const startOfDay = (date: Date) =>
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((startOfDay(now) - startOfDay(sent)) / 86_400_000);
}

/**
 * La décision, pour une mensualité, à un instant donné.
 *
 * L'ordre des questions est la règle métier elle-même, et il n'est pas
 * interchangeable : le règlement passe avant le calendrier, et l'absence de
 * destinataire avant tout le reste — un devis sans adresse n'est pas une
 * erreur, c'est un client qu'on facture autrement.
 */
export function decideEnvoi(context: EnvoiContext): EnvoiDecision {
  if (context.status === "skipped") return { action: "rien", reason: "annulee" };
  if (context.status === "paid") return { action: "rien", reason: "deja_payee" };
  if (!context.recipient_email) {
    return { action: "rien", reason: "sans_destinataire" };
  }
  if (context.issue_on > today(context.now)) {
    return { action: "rien", reason: "pas_encore_echue" };
  }

  const sentByKind = new Map(context.sent.map((mail) => [mail.kind, mail]));
  const initial = sentByKind.get("invoice");

  /* Rien n'est encore parti : la facture doit être créée si elle n'existe pas,
     puis envoyée. Les deux cas partagent la suite du chemin. */
  if (!initial) {
    return context.airwallex_invoice_id
      ? { action: "envoyer", kind: "invoice" }
      : { action: "emettre", kind: "invoice" };
  }

  const elapsed = daysSince(initial.sent_at, context.now);

  /* La première relance due qui n'est pas encore partie. On ne rattrape pas
     les précédentes : une facture restée trois mois sans passage ne déclenche
     pas trois mails d'un coup, elle reprend à la dernière due. */
  let candidate: BillingEmailKind | null = null;
  for (const step of REMINDER_SCHEDULE) {
    if (elapsed >= step.afterDays && !sentByKind.has(step.kind)) {
      candidate = step.kind;
    }
  }
  if (candidate) return { action: "envoyer", kind: candidate };

  const allSent = REMINDER_SCHEDULE.every((step) => sentByKind.has(step.kind));
  if (allSent) return { action: "rien", reason: "relances_epuisees" };

  return {
    action: "rien",
    reason: elapsed < REMINDER_SCHEDULE[0]!.afterDays
      ? "envoyee_relance_a_venir"
      : "pas_encore_l_heure",
  };
}
