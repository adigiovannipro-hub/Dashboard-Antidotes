import "server-only";

import { createClient } from "@/lib/supabase/server";
import { EXCLUDED_STATUSES } from "@/lib/planning/types";
import { shiftMonth, type PhaseSlice } from "./phases";
import type { ProductionSnapshot } from "./card-model";
import type { GenerationJob } from "./types";

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
  previous: { published: 0, total: 0 },
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

  const ensure = (workspaceId: string): ProductionSnapshot => {
    const existing = result.get(workspaceId);
    if (existing) return existing;
    const created: ProductionSnapshot = {
      workspace_id: workspaceId,
      moduleReady: true,
      phases: [],
      target: { ...EMPTY_SNAPSHOT.target },
      previous: { ...EMPTY_SNAPSHOT.previous },
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
      .in("month", [nextMonth, previousMonth])
      .is("deleted_at", null)
      .limit(200);
    months = (data ?? []) as unknown as MonthSlice[];
  }

  const monthIds = months.map((month) => month.id);
  const monthById = new Map(months.map((month) => [month.id, month]));

  const [phases, jobs, subjects, withWording] = await Promise.all([
    supabase
      .from("client_phases")
      .select("workspace_id, phase, target_month, status, completed_at, due_start, due_end")
      .in("workspace_id", options.workspaceIds)
      .in("target_month", [nextMonth, previousMonth])
      .limit(200)
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
    monthIds.length > 0
      ? supabase
          .from("planning_subjects")
          .select("id, workspace_id, month_id, status, scheduled_on")
          .in("month_id", monthIds)
          .is("deleted_at", null)
          .is("archived_at", null)
          .limit(2000)
          .then(({ data }) => (data ?? []) as unknown as SubjectSlice[])
      : Promise.resolve([] as SubjectSlice[]),
    // La présence d'un wording, sans rapatrier les textes : les ids suffisent.
    monthIds.length > 0
      ? supabase
          .from("planning_subjects")
          .select("id")
          .in("month_id", monthIds)
          .is("deleted_at", null)
          .is("archived_at", null)
          .not("wording", "is", null)
          .neq("wording", "")
          .limit(2000)
          .then(({ data }) => new Set(((data ?? []) as { id: string }[]).map((row) => row.id)))
      : Promise.resolve(new Set<string>()),
  ]);

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
      if (withWording.has(subject.id)) snapshot.target.withWording += 1;
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
    } else {
      snapshot.previous.total += 1;
      if (subject.status === "published") snapshot.previous.published += 1;
    }
  }

  return result;
}
