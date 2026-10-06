import "server-only";

import { formatMoney } from "@/lib/finance/money";
import { CHANNEL_LABELS, KIND_LABELS, STATUS_LABELS as CONVERSATION_STATUS_LABELS } from "@/lib/moderation/types";
import type { ConversationKind, ConversationStatus, ModerationChannel } from "@/lib/moderation/types";
import { withoutDailyTasks, type WorkTask } from "@/lib/mon-travail/types";
import { STATUS_LABELS as PLANNING_STATUS_LABELS, type PlanningStatus } from "@/lib/planning/types";
import {
  JOB_STATUS_LABELS,
  PHASE_LABELS,
  PHASE_STATUS_LABELS,
  type GenerationJobStatus,
  type ProductionPhase,
  type ProductionPhaseStatus,
} from "@/lib/production/types";

import type { ToolDefinition } from "./protocol";
import {
  admin,
  listWorkspaces,
  optionalClientArg,
  optionalWorkspace,
  ownerContext,
  rows,
  text,
  todayParis,
} from "./shared";
import { parseDay } from "./values";

/**
 * Mon espace : la todo, les cartes de production, l'Inbox, la Finance.
 *
 * La Finance est en lecture seule, par décision du 6/10 : rien d'ici ne
 * touche à une facture, un devis ou un automatisme d'envoi.
 */

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function monthStart(day: string, offset = 0): string {
  const date = new Date(`${day.slice(0, 7)}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 10);
}

export const AGENCE_TOOLS: ToolDefinition[] = [
  {
    name: "lire_mon_travail",
    description:
      "Ma todo du jour : les tâches ouvertes (aujourd'hui, les quatre jours suivants et les retards) avec leur identifiant, et les publications à sortir aujourd'hui ou en retard sur tous les plannings.",
    inputSchema: { type: "object", properties: { client: optionalClientArg } },
    readOnly: true,
    run: async (args) => {
      const client = admin();
      const workspace = await optionalWorkspace(client, args.client);
      const today = todayParis();
      const workspaces = new Map((await listWorkspaces(client)).map((w) => [w.id, w.name]));

      let taskQuery = client
        .from("work_tasks")
        .select("*")
        .eq("status", "pending")
        .lte("due_date", addDays(today, 4))
        .order("due_date")
        .order("created_at")
        .limit(200);
      let subjectQuery = client
        .from("planning_subjects")
        .select("id, workspace_id, name, status, scheduled_on")
        .lte("scheduled_on", today)
        .not("status", "in", "(published,dropped)")
        .is("deleted_at", null)
        .order("scheduled_on")
        .limit(100);
      if (workspace) {
        taskQuery = taskQuery.eq("workspace_id", workspace.id);
        subjectQuery = subjectQuery.eq("workspace_id", workspace.id);
      }
      const [taskResult, subjectResult] = await Promise.all([taskQuery, subjectQuery]);
      const tasks = withoutDailyTasks(rows<WorkTask>(taskResult, "Lecture des tâches"));
      const subjects = rows<{ id: string; workspace_id: string; name: string; status: PlanningStatus; scheduled_on: string }>(
        subjectResult,
        "Lecture des publications",
      );

      const taskLines = tasks.map(
        (task) =>
          `- [${task.due_date < today ? "RETARD " : ""}${task.due_date}] ${task.title}` +
          `${task.workspace_id ? ` · ${workspaces.get(task.workspace_id) ?? "?"}` : ""} · id ${task.id}`,
      );
      const subjectLines = subjects.map(
        (subject) =>
          `- [${subject.scheduled_on < today ? "RETARD " : ""}${subject.scheduled_on}] ${workspaces.get(subject.workspace_id) ?? "?"} · ${subject.name} · ${PLANNING_STATUS_LABELS[subject.status] ?? subject.status} · id ${subject.id}`,
      );
      return {
        text: [
          `# Tâches (${tasks.length})`,
          taskLines.join("\n") || "Aucune.",
          `# À publier aujourd'hui et en retard (${subjects.length})`,
          subjectLines.join("\n") || "Rien.",
        ].join("\n\n"),
      };
    },
  },

  {
    name: "creer_tache",
    description: "Ajoute une tâche à ma todo « Mon travail », rattachée ou non à un client.",
    inputSchema: {
      type: "object",
      properties: {
        titre: { type: "string", description: "La tâche, à l'infinitif." },
        echeance: { type: "string", description: "Date AAAA-MM-JJ (défaut : aujourd'hui)." },
        client: optionalClientArg,
      },
      required: ["titre"],
    },
    readOnly: false,
    run: async (args) => {
      const client = admin();
      const owner = await ownerContext(client);
      const workspace = await optionalWorkspace(client, args.client);
      const due = text(args.echeance) ? parseDay(args.echeance) : todayParis();
      const created = rows<{ id: string }>(
        await client
          .from("work_tasks")
          .insert({
            org_id: owner.orgId,
            workspace_id: workspace?.id ?? null,
            title: text(args.titre),
            source: "manual",
            due_date: due,
          } as never)
          .select("id"),
        "Tâche refusée",
      )[0];
      return { text: `Tâche ajoutée pour le ${due}${workspace ? ` (${workspace.name})` : ""} — id ${created?.id}.` };
    },
  },

  {
    name: "cocher_tache",
    description: "Coche (ou décoche) une tâche de ma todo. L'identifiant vient de lire_mon_travail.",
    inputSchema: {
      type: "object",
      properties: {
        tache_id: { type: "string", description: "Identifiant de la tâche." },
        faite: { type: "boolean", description: "true : cochée (défaut). false : rouverte." },
      },
      required: ["tache_id"],
    },
    readOnly: false,
    run: async (args) => {
      const client = admin();
      const owner = await ownerContext(client);
      const done = args.faite !== false;
      const updated = rows<{ title: string }>(
        await client
          .from("work_tasks")
          .update({ status: done ? "done" : "pending", done_at: done ? new Date().toISOString() : null } as never)
          .eq("id", text(args.tache_id))
          .eq("org_id", owner.orgId)
          // Une tâche supprimée ne revit pas par une coche.
          .neq("status", "deleted")
          .select("title"),
        "Écriture refusée",
      );
      if (updated.length === 0) return { text: "Tâche introuvable.", isError: true };
      return { text: `« ${updated[0]!.title} » ${done ? "cochée" : "rouverte"}.` };
    },
  },

  {
    name: "lire_cartes_production",
    description:
      "Le cycle de production de chaque client : état des phases (Intentions, Content, Validation, Reporting) pour le mois en cours et le suivant, avec leur fenêtre, et les dernières générations lancées.",
    inputSchema: { type: "object", properties: { client: optionalClientArg } },
    readOnly: true,
    run: async (args) => {
      const client = admin();
      const workspace = await optionalWorkspace(client, args.client);
      const today = todayParis();
      const months = [monthStart(today, -1), monthStart(today), monthStart(today, 1)];
      const names = new Map((await listWorkspaces(client)).map((w) => [w.id, w.name]));

      let phaseQuery = client
        .from("client_phases")
        .select("workspace_id, phase, target_month, status, completed_at, due_start, due_end")
        .in("target_month", months);
      let jobQuery = client
        .from("generation_jobs")
        .select("workspace_id, phase, target_month, status, progress_current, progress_total, error_message, created_at")
        .order("created_at", { ascending: false })
        .limit(workspace ? 10 : 30);
      if (workspace) {
        phaseQuery = phaseQuery.eq("workspace_id", workspace.id);
        jobQuery = jobQuery.eq("workspace_id", workspace.id);
      }
      const [phaseResult, jobResult] = await Promise.all([phaseQuery, jobQuery]);
      const phases = rows<{
        workspace_id: string;
        phase: ProductionPhase;
        target_month: string;
        status: ProductionPhaseStatus;
        due_start: string | null;
        due_end: string | null;
      }>(phaseResult, "Lecture des phases");
      const jobs = rows<{
        workspace_id: string;
        phase: ProductionPhase;
        target_month: string;
        status: GenerationJobStatus;
        progress_current: number;
        progress_total: number;
        error_message: string | null;
        created_at: string;
      }>(jobResult, "Lecture des générations");

      const phaseLines = phases
        .sort((a, b) => (names.get(a.workspace_id) ?? "").localeCompare(names.get(b.workspace_id) ?? "") || a.target_month.localeCompare(b.target_month))
        .map((phase) => {
          const late = phase.status !== "done" && phase.status !== "skipped" && phase.due_end && phase.due_end < today;
          return `- ${names.get(phase.workspace_id) ?? "?"} · ${phase.target_month.slice(0, 7)} · ${PHASE_LABELS[phase.phase]} : ${PHASE_STATUS_LABELS[phase.status]}${late ? " (EN RETARD)" : ""}${phase.due_end ? ` · fenêtre jusqu'au ${phase.due_end}` : ""}`;
        });
      const jobLines = jobs.map(
        (job) =>
          `- ${job.created_at.slice(0, 16).replace("T", " ")} · ${names.get(job.workspace_id) ?? "?"} · ${PHASE_LABELS[job.phase]} ${job.target_month.slice(0, 7)} : ${JOB_STATUS_LABELS[job.status]} (${job.progress_current}/${job.progress_total})${job.error_message ? ` — ${job.error_message}` : ""}`,
      );
      return {
        text: [
          "# Phases posées",
          "(une phase absente est « à faire »)",
          phaseLines.join("\n") || "Aucune.",
          "# Dernières générations",
          jobLines.join("\n") || "Aucune.",
        ].join("\n\n"),
      };
    },
  },

  {
    name: "lire_inbox",
    description:
      "L'Inbox de modération. Sans conversation_id : les conversations à traiter (commentaires et messages privés), les plus récentes d'abord. Avec : le fil complet et le dernier brouillon de réponse.",
    inputSchema: {
      type: "object",
      properties: {
        client: optionalClientArg,
        conversation_id: { type: "string", description: "Identifiant d'une conversation, pour lire son fil." },
      },
    },
    readOnly: true,
    run: async (args) => {
      const client = admin();
      const owner = await ownerContext(client);
      const modClients = rows<{ id: string; name: string; workspace_id: string | null }>(
        await client.from("moderation_clients").select("id, name, workspace_id").eq("org_id", owner.orgId),
        "Lecture des clients de modération",
      );
      const clientNames = new Map(modClients.map((c) => [c.id, c.name]));

      const conversationId = text(args.conversation_id);
      if (conversationId) {
        const conversation = rows<{
          id: string;
          client_id: string;
          channel: ModerationChannel;
          kind: ConversationKind;
          participant_handle: string | null;
          status: ConversationStatus;
          post_excerpt: string | null;
          post_permalink: string | null;
        }>(
          await client
            .from("conversations")
            .select("id, client_id, channel, kind, participant_handle, status, post_excerpt, post_permalink")
            .eq("id", conversationId)
            .in("client_id", modClients.map((c) => c.id)),
          "Lecture de la conversation",
        )[0];
        if (!conversation) return { text: "Conversation introuvable.", isError: true };
        const [messageResult, draftResult] = await Promise.all([
          client
            .from("messages")
            .select("direction, author_handle, body, sent_at")
            .eq("conversation_id", conversation.id)
            .order("sent_at"),
          client
            .from("drafts")
            .select("body, status, created_at")
            .eq("conversation_id", conversation.id)
            .order("created_at", { ascending: false })
            .limit(1),
        ]);
        const messages = rows<{ direction: string; author_handle: string | null; body: string; sent_at: string }>(
          messageResult,
          "Lecture des messages",
        );
        const draft = rows<{ body: string; status: string }>(draftResult, "Lecture du brouillon")[0];
        return {
          text: [
            `# ${clientNames.get(conversation.client_id)} · ${CHANNEL_LABELS[conversation.channel]} · ${KIND_LABELS[conversation.kind]} · ${CONVERSATION_STATUS_LABELS[conversation.status]}`,
            conversation.post_excerpt ? `Publication : ${conversation.post_excerpt}${conversation.post_permalink ? ` (${conversation.post_permalink})` : ""}` : null,
            messages
              .map(
                (message) =>
                  `[${message.sent_at.slice(0, 16).replace("T", " ")}] ${message.direction === "inbound" ? message.author_handle ?? conversation.participant_handle ?? "?" : "Marque"} : ${message.body || "(pièce jointe)"}`,
              )
              .join("\n"),
            draft ? `Brouillon (${draft.status}) : ${draft.body}` : "Aucun brouillon.",
          ]
            .filter(Boolean)
            .join("\n\n"),
        };
      }

      const workspace = await optionalWorkspace(client, args.client);
      const ids = (workspace ? modClients.filter((c) => c.workspace_id === workspace.id) : modClients).map((c) => c.id);
      if (ids.length === 0) return { text: "Aucune Inbox pour ce client." };
      const conversations = rows<{
        id: string;
        client_id: string;
        channel: ModerationChannel;
        kind: ConversationKind;
        participant_handle: string | null;
        excerpt: string | null;
        unread: boolean;
        last_message_at: string;
        flags: string[];
      }>(
        await client
          .from("conversations")
          .select("id, client_id, channel, kind, participant_handle, excerpt, unread, last_message_at, flags")
          .in("client_id", ids)
          .eq("status", "to_process")
          .is("deleted_at", null)
          .order("last_message_at", { ascending: false })
          .limit(40),
        "Lecture des conversations",
      );
      if (conversations.length === 0) return { text: "Rien à traiter." };
      return {
        text: conversations
          .map(
            (c) =>
              `- ${c.unread ? "● " : ""}${clientNames.get(c.client_id)} · ${CHANNEL_LABELS[c.channel]} · ${KIND_LABELS[c.kind]} · ${c.participant_handle ?? "?"} · ${c.last_message_at.slice(0, 16).replace("T", " ")}${c.flags.length ? ` · ${c.flags.join(",")}` : ""}\n  « ${c.excerpt ?? ""} » — id ${c.id}`,
          )
          .join("\n"),
      };
    },
  },

  {
    name: "generer_brouillon_reponse",
    description:
      "Pose un brouillon de réponse sur une conversation de l'Inbox. Rien n'est envoyé : le brouillon s'affiche dans l'Inbox, où il se relit, se corrige et se valide. Écrire le texte selon le registre du canal (commentaire court ; message privé « Bonjour … L'équipe {client} ») en s'appuyant sur lire_faq.",
    inputSchema: {
      type: "object",
      properties: {
        conversation_id: { type: "string", description: "Identifiant (lire_inbox)." },
        texte: { type: "string", description: "Le texte de la réponse proposée." },
      },
      required: ["conversation_id", "texte"],
    },
    readOnly: false,
    run: async (args) => {
      const client = admin();
      const owner = await ownerContext(client);
      const modClientIds = rows<{ id: string }>(
        await client.from("moderation_clients").select("id").eq("org_id", owner.orgId),
        "Lecture des clients de modération",
      ).map((c) => c.id);
      const conversation = rows<{ id: string; client_id: string; detected_locale: string | null }>(
        await client
          .from("conversations")
          .select("id, client_id, detected_locale")
          .eq("id", text(args.conversation_id))
          .in("client_id", modClientIds),
        "Lecture de la conversation",
      )[0];
      if (!conversation) return { text: "Conversation introuvable.", isError: true };

      // Un seul brouillon proposé à la fois, comme à l'écran.
      const { error: expireError } = await client
        .from("drafts")
        .update({ status: "expired" } as never)
        .eq("conversation_id", conversation.id)
        .eq("status", "proposed");
      if (expireError) throw new Error(`Brouillon précédent : ${expireError.message}`);
      const { error } = await client.from("drafts").insert({
        conversation_id: conversation.id,
        client_id: conversation.client_id,
        body: text(args.texte),
        locale: conversation.detected_locale ?? "fr",
        model: "claude-connecteur",
        prompt_version: "mcp",
        status: "proposed",
        sources: [],
      } as never);
      if (error) throw new Error(`Brouillon refusé : ${error.message}`);
      return { text: "Brouillon posé dans l'Inbox, à relire et valider depuis l'application." };
    },
  },

  {
    name: "lire_finance",
    description:
      "Ma finance, en lecture seule : trésorerie disponible par compte, dépenses carte du mois (total et détail), factures en cours ou en retard, et mensualités des devis à facturer.",
    inputSchema: {
      type: "object",
      properties: { mois: { type: "string", description: "Mois des dépenses AAAA-MM (défaut : le mois en cours)." } },
    },
    readOnly: true,
    run: async (args) => {
      const client = admin();
      const owner = await ownerContext(client);
      const today = todayParis();
      const month = text(args.mois) ? `${text(args.mois).slice(0, 7)}-01` : monthStart(today);
      const next = monthStart(month, 1);

      const accounts = rows<{ id: string; name: string; currency: string }>(
        await client.from("finance_accounts").select("id, name, currency").eq("org_id", owner.orgId).order("currency"),
        "Lecture des comptes",
      );
      const balances = await Promise.all(
        accounts.map(async (account) => {
          const latest = rows<{ available_cents: number; snapshot_hour: string }>(
            await client
              .from("finance_balances_history")
              .select("available_cents, snapshot_hour")
              .eq("account_id", account.id)
              .order("snapshot_hour", { ascending: false })
              .limit(1),
            "Lecture des soldes",
          )[0];
          return { account, latest };
        }),
      );

      const [expenseResult, invoiceResult, installmentResult] = await Promise.all([
        client
          .from("finance_transactions")
          .select("occurred_at, merchant, amount_cents, currency, billing_amount_cents, billing_currency")
          .eq("org_id", owner.orgId)
          .lt("amount_cents", 0)
          .gte("occurred_at", month)
          .lt("occurred_at", next)
          .order("occurred_at", { ascending: false })
          .limit(200),
        client
          .from("finance_invoices")
          .select("client_name, amount_cents, currency, status, issued_on, due_on")
          .eq("org_id", owner.orgId)
          .in("status", ["draft", "sent"])
          .order("due_on", { ascending: true, nullsFirst: false }),
        client
          .from("billing_installments")
          .select("engagement_id, service_month, amount_cents, currency, issue_on, status")
          .eq("org_id", owner.orgId)
          .eq("status", "pending")
          .lte("issue_on", addDays(today, 31))
          .order("issue_on"),
      ]);
      const expenses = rows<{
        occurred_at: string;
        merchant: string | null;
        amount_cents: number;
        currency: string;
        billing_amount_cents: number | null;
        billing_currency: string | null;
      }>(expenseResult, "Lecture des dépenses");
      const invoices = rows<{
        client_name: string;
        amount_cents: number;
        currency: string;
        status: string;
        issued_on: string | null;
        due_on: string | null;
      }>(invoiceResult, "Lecture des factures");
      const installments = rows<{
        engagement_id: string;
        service_month: string;
        amount_cents: number;
        currency: string;
        issue_on: string;
      }>(installmentResult, "Lecture des échéances");
      const engagements = installments.length
        ? new Map(
            rows<{ id: string; client_name: string; label: string }>(
              await client
                .from("billing_engagements")
                .select("id, client_name, label")
                .in("id", [...new Set(installments.map((i) => i.engagement_id))]),
              "Lecture des devis",
            ).map((e) => [e.id, `${e.client_name} — ${e.label}`]),
          )
        : new Map<string, string>();

      // Jamais de conversion : un total par devise, débité du wallet quand il diffère.
      const spent = new Map<string, number>();
      for (const expense of expenses) {
        const currency = expense.billing_currency ?? expense.currency;
        const cents = Math.abs(expense.billing_amount_cents ?? expense.amount_cents);
        spent.set(currency, (spent.get(currency) ?? 0) + cents);
      }

      return {
        text: [
          "# Trésorerie disponible",
          balances
            .map(({ account, latest }) => `- ${account.name} (${account.currency}) : ${latest ? formatMoney(latest.available_cents, account.currency) : "—"}`)
            .join("\n") || "Aucun compte.",
          `# Dépenses carte ${month.slice(0, 7)} : ${[...spent].map(([currency, cents]) => formatMoney(cents, currency)).join(" + ") || "0"}`,
          expenses
            .slice(0, 60)
            .map((e) => `- ${e.occurred_at.slice(0, 10)} · ${e.merchant ?? "?"} · ${formatMoney(Math.abs(e.amount_cents), e.currency)}`)
            .join("\n") || "Aucune.",
          "# Factures en cours",
          invoices
            .map(
              (i) =>
                `- ${i.client_name} · ${formatMoney(i.amount_cents, i.currency)} · ${i.status === "draft" ? "brouillon" : "envoyée"} · échéance ${i.due_on ?? "—"}${i.status === "sent" && i.due_on && i.due_on < today ? " (EN RETARD)" : ""}`,
            )
            .join("\n") || "Aucune.",
          "# Mensualités à facturer (31 jours)",
          installments
            .map((i) => `- ${i.issue_on} · ${engagements.get(i.engagement_id) ?? "?"} · ${i.service_month.slice(0, 7)} · ${formatMoney(i.amount_cents, i.currency)} HT`)
            .join("\n") || "Aucune.",
        ].join("\n\n"),
      };
    },
  },
];
