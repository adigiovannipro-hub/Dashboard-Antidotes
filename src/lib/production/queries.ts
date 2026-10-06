import "server-only";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { EXCLUDED_STATUSES } from "@/lib/planning/types";
import { shiftMonth, type PhaseSlice } from "./phases";
import { AHEAD_MONTHS, EMPTY_AHEAD, PAST_MONTHS, type ProductionSnapshot } from "./card-model";
import type { ClientReport, GenerationJob } from "./types";
import { needsContent } from "./wording-state";

/**
 * Lectures du module Production — tout ce que les cartes client de l'accueil
 * consomment, chargé pour tous les espaces d'un coup. La forme du résultat
 * (`ProductionSnapshot`) vit dans `card-model.ts`, le module pur qui
 * l'assemble en carte.
 *
 * Comme partout : la RLS cadre déjà ce qui est visible, l'erreur est ignorée
 * et une liste vide est une réponse.
 */

export type { ProductionSnapshot };

/**
 * Une table absente, par opposition à une table vide.
 *
 * C'est l'exception à la règle des `queries.ts` — où l'erreur est ignorée
 * parce que la RLS est l'autorité et qu'une liste vide est la bonne réponse.
 * Ici une liste vide n'est *pas* la bonne réponse : elle se lirait « aucune
 * phase faite » et la carte affirmerait un retard qu'elle ne sait pas.
 *
 * `42P01` est le code Postgres ; `PGRST205` celui de PostgREST quand la table
 * manque à son cache de schéma.
 */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return /does not exist|schema cache/i.test(error.message ?? "");
}

const EMPTY_SNAPSHOT: Omit<ProductionSnapshot, "workspace_id"> = {
  moduleReady: true,
  phases: [],
  target: { total: 0, withWording: 0, validated: 0, scheduled: 0, firstPublication: null },
  previous: { published: 0, total: 0, hasRealData: false },
  ahead: {},
  jobs: [],
};

type MonthSlice = { id: string; workspace_id: string; month: string };
type SubjectSlice = {
  id: string;
  workspace_id: string;
  month_id: string;
  status: string;
  scheduled_on: string | null;
};

/**
 * La synthèse d'un mois, si elle a été générée.
 *
 * Owner-only par la RLS de 0057 : un client ne lit pas le bilan que l'agence
 * écrit sur son propre compte. L'appelant passe quand même la garde de rôle
 * avant d'afficher le panneau — en accès ouvert, la RLS ne protège plus rien.
 *
 * L'erreur est ignorée comme partout dans les `queries.ts` : une table absente
 * vaut « pas de rapport », et le panneau ne s'affiche simplement pas.
 */
export async function getClientReport(options: {
  workspaceId: string;
  /** Premier jour du mois analysé, `YYYY-MM-01`. */
  month: string;
}): Promise<ClientReport | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_reports")
    .select("*")
    .eq("workspace_id", options.workspaceId)
    .eq("target_month", options.month)
    .maybeSingle();
  return (data as unknown as ClientReport | null) ?? null;
}

/**
 * Les dernières synthèses d'un espace, **avant** un mois donné.
 *
 * C'est ce qui ferme la boucle : jusqu'ici `client_reports` n'était lu que par
 * l'écran, et aucune phase de génération ne relisait ce que le mois précédent
 * avait conclu. Les intentions repartaient donc chaque mois de zéro, et la
 * rédaction choisissait ses précédents par récence, pas par performance.
 *
 * Le worker de génération n'a pas de session — il tourne après la réponse HTTP,
 * comme un cron — et passe donc son propre client admin. Depuis une page, le
 * client par défaut suffit.
 */
export async function listRecentClientReports(options: {
  workspaceId: string;
  /** Mois exclu, `YYYY-MM-01` : celui qu'on prépare n'a rien à s'apprendre. */
  before: string;
  limit?: number;
  client?: ReturnType<typeof createAdminClient>;
}): Promise<ClientReport[]> {
  const supabase = options.client ?? (await createClient());
  const { data } = await supabase
    .from("client_reports")
    .select("*")
    .eq("workspace_id", options.workspaceId)
    .lt("target_month", options.before)
    .order("target_month", { ascending: false })
    .limit(options.limit ?? 3);
  return (data ?? []) as unknown as ClientReport[];
}

/** Toutes les lignes d'une lecture, page par page de mille. */
async function readAllPages<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const size = 1000;
  const rows: T[] = [];
  for (let from = 0; from < 50_000; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) break;
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < size) break;
  }
  return rows;
}

export async function getProductionSnapshots(options: {
  workspaceIds: string[];
  today: string;
}): Promise<Map<string, ProductionSnapshot>> {
  const result = new Map<string, ProductionSnapshot>();
  if (options.workspaceIds.length === 0) return result;

  const supabase = await createClient();
  const monthKey = options.today.slice(0, 7);
  const nextMonth = `${shiftMonth(monthKey, 1)}-01`;
  const previousMonth = `${shiftMonth(monthKey, -1)}-01`;
  // Une seule plage pour tous les mois du sélecteur, du plus ancien au
  // dernier mois d'avance : le sélecteur n'a pas besoin d'un aller-retour
  // réseau à chaque flèche.
  const firstMonth = `${shiftMonth(monthKey, -PAST_MONTHS)}-01`;
  const lastMonth = `${shiftMonth(monthKey, 1 + AHEAD_MONTHS)}-01`;

  const ensure = (workspaceId: string): ProductionSnapshot => {
    const existing = result.get(workspaceId);
    if (existing) return existing;
    const created: ProductionSnapshot = {
      workspace_id: workspaceId,
      moduleReady: true,
      phases: [],
      target: { ...EMPTY_SNAPSHOT.target },
      previous: { ...EMPTY_SNAPSHOT.previous },
      ahead: {},
      jobs: [],
    };
    result.set(workspaceId, created);
    return created;
  };

  for (const workspaceId of options.workspaceIds) ensure(workspaceId);

  // Les mois du planning se trouvent par leur groupe (`planning_months`), pas
  // par `scheduled_on` : une intention sans date appartient quand même à son
  // mois. Seuls les boards éditoriaux comptent — la FAQ n'a pas de mois.
  const { data: boards } = await supabase
    .from("planning_boards")
    .select("id")
    .in("workspace_id", options.workspaceIds)
    .eq("kind", "editorial")
    .limit(100);

  const boardIds = (boards ?? []).map((board) => board.id);

  let months: MonthSlice[] = [];
  if (boardIds.length > 0) {
    const { data } = await supabase
      .from("planning_months")
      .select("id, workspace_id, month")
      .in("board_id", boardIds)
      .gte("month", firstMonth)
      .lte("month", lastMonth)
      .is("deleted_at", null)
      .limit(1000);
    months = (data ?? []) as unknown as MonthSlice[];
  }

  const monthIds = months.map((month) => month.id);
  const monthById = new Map(months.map((month) => [month.id, month]));

  // Le mois précédent, borné : le reporting l'analyse, et sa garde doit savoir
  // si les régies ont mesuré quelque chose — pas seulement si un tableau a été
  // rempli à la main.
  const previousEnd = new Date(
    Date.UTC(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)) - 1, 0),
  )
    .toISOString()
    .slice(0, 10);

  const [phases, jobs, subjects, withWording, mesures] = await Promise.all([
    supabase
      .from("client_phases")
      .select("workspace_id, phase, target_month, status, completed_at, due_start, due_end")
      .in("workspace_id", options.workspaceIds)
      .gte("target_month", firstMonth)
      .lte("target_month", lastMonth)
      .limit(1000)
      .then(({ data, error }) => ({
        rows: (data ?? []) as unknown as (PhaseSlice & { workspace_id: string })[],
        missing: isMissingTable(error),
      })),
    supabase
      .from("generation_jobs")
      .select("*")
      .in("workspace_id", options.workspaceIds)
      .order("created_at", { ascending: false })
      .limit(60)
      .then(({ data, error }) => ({
        rows: (data ?? []) as unknown as GenerationJob[],
        missing: isMissingTable(error),
      })),
    // Par pages : l'API plafonne une réponse à mille lignes, et un an de
    // planning sur plusieurs espaces les dépasse — un `limit` plus haut serait
    // tronqué sans le dire, et les compteurs de la carte mentiraient.
    monthIds.length > 0
      ? readAllPages<SubjectSlice>((from, to) =>
          supabase
            .from("planning_subjects")
            .select("id, workspace_id, month_id, status, scheduled_on")
            .in("month_id", monthIds)
            .is("deleted_at", null)
            .is("archived_at", null)
            .order("id")
            .range(from, to),
        )
      : Promise.resolve([] as SubjectSlice[]),
    // La présence d'un wording, sans rapatrier les textes : les ids suffisent.
    monthIds.length > 0
      ? readAllPages<{ id: string }>((from, to) =>
          supabase
            .from("planning_subjects")
            .select("id")
            .in("month_id", monthIds)
            .is("deleted_at", null)
            .is("archived_at", null)
            .not("wording", "is", null)
            .neq("wording", "")
            .order("id")
            .range(from, to),
        ).then((rows) => new Set(rows.map((row) => row.id)))
      : Promise.resolve(new Set<string>()),
    // Trois lectures d'une seule colonne : on ne veut pas les chiffres, juste
    // savoir quels espaces en ont. Un relevé d'abonnés compte — c'est une
    // mesure du mois, même sans publication.
    Promise.all([
      supabase
        .from("ad_metrics_daily")
        .select("workspace_id")
        .in("workspace_id", options.workspaceIds)
        .gte("date", previousMonth)
        .lte("date", previousEnd)
        .limit(5000),
      supabase
        .from("social_posts")
        .select("workspace_id")
        .in("workspace_id", options.workspaceIds)
        .gte("published_at", `${previousMonth}T00:00:00Z`)
        .lte("published_at", `${previousEnd}T23:59:59Z`)
        .limit(2000),
      supabase
        .from("social_followers")
        .select("workspace_id")
        .in("workspace_id", options.workspaceIds)
        .gte("date", previousMonth)
        .lte("date", previousEnd)
        .limit(5000),
    ]).then((results) => {
      const found = new Set<string>();
      for (const { data } of results) {
        for (const row of (data ?? []) as unknown as { workspace_id: string }[]) {
          found.add(row.workspace_id);
        }
      }
      return found;
    }),
  ]);

  for (const workspaceId of mesures) {
    const snapshot = result.get(workspaceId);
    if (snapshot) snapshot.previous.hasRealData = true;
  }

  // Une seule des deux tables suffit à déclarer le module absent : elles
  // arrivent par la même migration, et un demi-module ne se montre pas.
  if (phases.missing || jobs.missing) {
    for (const snapshot of result.values()) snapshot.moduleReady = false;
  }

  for (const row of phases.rows) {
    ensure(row.workspace_id).phases.push(row);
  }

  for (const job of jobs.rows) {
    ensure(job.workspace_id).jobs.push(job);
  }

  for (const subject of subjects) {
    if (EXCLUDED_STATUSES.includes(subject.status as never)) continue;
    const month = monthById.get(subject.month_id);
    if (!month) continue;
    const snapshot = ensure(subject.workspace_id);

    if (month.month === nextMonth) {
      snapshot.target.total += 1;
      // « Rédigé » au sens du bouton = ce que la phase Content ne retouchera
      // pas. Même prédicat que le worker, sinon la carte annonce un nombre et
      // le job en traite un autre.
      if (
        !needsContent({
          status: subject.status,
          hasWording: withWording.has(subject.id),
        })
      ) {
        snapshot.target.withWording += 1;
      }
      if (subject.status === "validated") snapshot.target.validated += 1;
      if (subject.status === "scheduled" || subject.status === "published") {
        snapshot.target.scheduled += 1;
      }
      if (
        subject.scheduled_on !== null &&
        (snapshot.target.firstPublication === null ||
          subject.scheduled_on < snapshot.target.firstPublication)
      ) {
        snapshot.target.firstPublication = subject.scheduled_on;
      }
    } else if (month.month === previousMonth) {
      snapshot.previous.total += 1;
      if (subject.status === "published") snapshot.previous.published += 1;
    }

    // Chaque mois hors du mois par défaut — passés, en cours, d'avance : on
    // ne retient que ce que leur vue affiche, sans fenêtre ni première date.
    if (month.month !== nextMonth) {
      const stats = (snapshot.ahead[month.month] ??= { ...EMPTY_AHEAD });
      stats.total += 1;
      if (
        !needsContent({
          status: subject.status,
          hasWording: withWording.has(subject.id),
        })
      ) {
        stats.withWording += 1;
      }
      if (subject.status === "validated") stats.validated += 1;
    }
  }

  return result;
}
