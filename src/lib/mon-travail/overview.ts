import "server-only";

import { getModerationContext } from "@/lib/moderation/access";
import { ACTIONABLE_STATUSES } from "@/lib/moderation/types";
import { createClient } from "@/lib/supabase/server";
import { EXCLUDED_STATUSES, DONE_STATUSES } from "@/lib/planning/types";
import { addDays, lastDayOfMonth } from "./dates";

/**
 * Les agrégats de la page d'accueil.
 *
 * La bande haute et les cartes d'espace ne montrent que du réel : chaque
 * chiffre vient d'une requête, aucun n'est estimé. Quand une source est
 * absente — pas de compte Airwallex, pas de client de modération — la valeur
 * est `null`, la carte affiche « — » et le dit. Un zéro inventé se lit comme
 * une mesure, et c'est ainsi qu'on prend une décision sur du vide.
 *
 * Toutes les lectures passent par le client porteur de la session : la RLS
 * cadre déjà ce qui est visible, il n'y a pas de filtre défensif à ajouter.
 */

/** L'horizon de la carte « publications programmées ». */
export const PUBLICATION_HORIZON_DAYS = 7;

export type OverviewStats = {
  publications: { total: number; horizonDays: number };
  moderation: { pending: number } | null;
  tasks: { open: number; overdue: number };
  invoices: { pendingCents: number; count: number; overdue: number } | null;
};

/** Ce qu'une carte d'espace affiche en plus de son nom. */
export type WorkspaceStats = {
  /** Publications à venir sur l'horizon, hors publiées et non retenues. */
  upcoming: number;
  /** Publications du jour déjà parties — la preuve que la journée est faite. */
  publishedToday: number;
  /** Conversations en attente, `null` si l'espace n'a pas de modération. */
  moderation: number | null;
  /** Prochaine échéance de tâche pour cet espace, `YYYY-MM-DD`. */
  nextDue: string | null;
  /** Part des publications du mois déjà publiées, entre 0 et 1. */
  monthProgress: { done: number; total: number } | null;
};

/**
 * Un espace sans aucune ligne : zéro partout, pas « inconnu ».
 *
 * Les requêtes balaient tous les espaces accessibles d'un coup : l'absence
 * d'un espace dans le résultat signifie qu'il n'a rien, pas qu'on ignore ce
 * qu'il a. Afficher « — » là où la réponse est « 0 » ferait croire à une
 * mesure manquante, et deux cartes voisines cesseraient d'être comparables.
 */
export const NO_WORKSPACE_ACTIVITY: WorkspaceStats = {
  upcoming: 0,
  publishedToday: 0,
  moderation: null,
  nextDue: null,
  monthProgress: null,
};

type SubjectSlice = {
  workspace_id: string;
  status: string;
  scheduled_on: string | null;
};

/**
 * Une seule lecture des publications pour toute la page.
 *
 * La bande haute, les cartes d'espace et la barre de progression du mois
 * tapent toutes dans le même ensemble : le charger une fois évite trois
 * allers-retours qui renverraient les mêmes lignes.
 */
async function loadSubjects(today: string): Promise<SubjectSlice[]> {
  const supabase = await createClient();

  // Du premier du mois — la progression mensuelle en a besoin — au plus tard
  // entre la fin du mois et l'horizon des sept jours, qui le déborde en fin
  // de mois. Le dernier jour est calculé, jamais supposé à 31.
  const monthKey = today.slice(0, 7);
  const from = `${monthKey}-01`;
  const monthEnd = `${monthKey}-${String(lastDayOfMonth(monthKey)).padStart(2, "0")}`;
  const horizon = addDays(today, PUBLICATION_HORIZON_DAYS);
  const to = horizon > monthEnd ? horizon : monthEnd;

  const { data } = await supabase
    .from("planning_subjects")
    .select("workspace_id, status, scheduled_on")
    .gte("scheduled_on", from)
    .lte("scheduled_on", to)
    .limit(2000);

  return (data ?? []) as unknown as SubjectSlice[];
}

/** Conversations actionnables, par client de modération. */
async function loadModerationPending(): Promise<Map<string, number> | null> {
  const context = await getModerationContext();
  if (context.clients.length === 0) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("conversations")
    .select("client_id, status")
    .is("deleted_at", null)
    .in("status", ACTIONABLE_STATUSES)
    .limit(2000);

  const byClient = new Map<string, number>();
  for (const client of context.clients) byClient.set(client.id, 0);

  for (const row of (data ?? []) as unknown as { client_id: string }[]) {
    byClient.set(row.client_id, (byClient.get(row.client_id) ?? 0) + 1);
  }

  // Rattaché à l'espace et non au client de modération : c'est l'espace que
  // la carte affiche. Un client de modération sans espace ne compte que dans
  // le total global.
  const byWorkspace = new Map<string, number>();
  byWorkspace.set("__total__", 0);
  for (const client of context.clients) {
    const count = byClient.get(client.id) ?? 0;
    byWorkspace.set("__total__", (byWorkspace.get("__total__") ?? 0) + count);
    if (client.workspace_id) {
      byWorkspace.set(
        client.workspace_id,
        (byWorkspace.get(client.workspace_id) ?? 0) + count,
      );
    }
  }

  return byWorkspace;
}

export async function getOverview(options: {
  today: string;
  isOwner: boolean;
  orgId: string | null;
}): Promise<{ stats: OverviewStats; byWorkspace: Map<string, WorkspaceStats> }> {
  const { today } = options;
  const horizon = addDays(today, PUBLICATION_HORIZON_DAYS);
  const supabase = await createClient();

  const [subjects, moderationPending, { data: taskRows }, invoices] =
    await Promise.all([
      loadSubjects(today),
      loadModerationPending(),
      supabase
        .from("work_tasks")
        .select("workspace_id, status, due_date")
        .eq("status", "pending")
        .limit(1000),
      options.isOwner && options.orgId ? loadInvoices(options.orgId) : null,
    ]);

  // --- Publications ---------------------------------------------------------
  const planned = subjects.filter(
    (subject) =>
      subject.scheduled_on !== null &&
      !EXCLUDED_STATUSES.includes(subject.status as never),
  );

  const upcoming = planned.filter(
    (subject) =>
      subject.scheduled_on! >= today &&
      subject.scheduled_on! <= horizon &&
      !DONE_STATUSES.includes(subject.status as never),
  );

  // --- Tâches ---------------------------------------------------------------
  const tasks = (taskRows ?? []) as unknown as {
    workspace_id: string | null;
    due_date: string;
  }[];
  const overdue = tasks.filter((task) => task.due_date < today);

  // --- Par espace -----------------------------------------------------------
  const byWorkspace = new Map<string, WorkspaceStats>();
  const ensure = (workspaceId: string): WorkspaceStats => {
    const existing = byWorkspace.get(workspaceId);
    if (existing) return existing;
    const created: WorkspaceStats = {
      upcoming: 0,
      publishedToday: 0,
      moderation: moderationPending?.get(workspaceId) ?? null,
      nextDue: null,
      monthProgress: null,
    };
    byWorkspace.set(workspaceId, created);
    return created;
  };

  for (const subject of upcoming) ensure(subject.workspace_id).upcoming += 1;

  for (const subject of planned) {
    if (
      subject.scheduled_on === today &&
      DONE_STATUSES.includes(subject.status as never)
    ) {
      ensure(subject.workspace_id).publishedToday += 1;
    }
  }

  const monthKey = today.slice(0, 7);
  for (const subject of planned) {
    if (!subject.scheduled_on?.startsWith(monthKey)) continue;
    const stats = ensure(subject.workspace_id);
    const progress = stats.monthProgress ?? { done: 0, total: 0 };
    progress.total += 1;
    if (DONE_STATUSES.includes(subject.status as never)) progress.done += 1;
    stats.monthProgress = progress;
  }

  for (const task of tasks) {
    if (!task.workspace_id) continue;
    const stats = ensure(task.workspace_id);
    if (stats.nextDue === null || task.due_date < stats.nextDue) {
      stats.nextDue = task.due_date;
    }
  }

  // Un espace sans publication ni tâche doit tout de même porter son compteur
  // de modération : il n'a pas été créé par les boucles ci-dessus.
  for (const [workspaceId, count] of moderationPending ?? []) {
    if (workspaceId === "__total__") continue;
    ensure(workspaceId).moderation = count;
  }

  return {
    stats: {
      publications: {
        total: upcoming.length,
        horizonDays: PUBLICATION_HORIZON_DAYS,
      },
      moderation: moderationPending
        ? { pending: moderationPending.get("__total__") ?? 0 }
        : null,
      tasks: { open: tasks.length, overdue: overdue.length },
      invoices,
    },
    byWorkspace,
  };
}

/**
 * Factures émises et non encaissées.
 *
 * Les brouillons sont exclus : une facture non envoyée n'attend personne. Le
 * total est en centimes EUR — les factures d'une autre devise ne s'additionnent
 * pas, et le module Finance ne convertit jamais.
 */
async function loadInvoices(
  orgId: string,
): Promise<{ pendingCents: number; count: number; overdue: number } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("finance_invoices")
    .select("amount_cents, currency, status, due_on")
    .eq("org_id", orgId)
    .eq("status", "sent")
    .limit(500);

  // Le module Finance peut ne jamais avoir été amorcé : c'est une absence de
  // données, pas une erreur à afficher.
  if (error) return null;

  const rows = (data ?? []) as unknown as {
    amount_cents: number;
    currency: string;
    due_on: string | null;
  }[];
  if (rows.length === 0) return { pendingCents: 0, count: 0, overdue: 0 };

  const today = new Date().toISOString().slice(0, 10);
  const eur = rows.filter((row) => row.currency === "EUR");

  return {
    pendingCents: eur.reduce((sum, row) => sum + row.amount_cents, 0),
    count: rows.length,
    overdue: rows.filter((row) => row.due_on !== null && row.due_on < today).length,
  };
}
