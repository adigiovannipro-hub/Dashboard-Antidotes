import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  MonthSummary,
  PlanningMonth,
  PlanningPlatform,
  PlanningSyncRun,
  SubjectWithLane,
} from "./types";

export type { MonthSummary };

/**
 * Lectures du module.
 *
 * Toutes passent par le client porteur de la session : la RLS fait le
 * cloisonnement, il n'y a donc aucun `where client_id` défensif à ajouter — un
 * éditeur d'un autre client ne verrait rien même sans filtre. Le filtre présent
 * ici sert à cibler, pas à protéger.
 */

/** Le sujet, son couloir et son mois, en une seule requête. */
const SUBJECT_SELECT =
  "*, planning_lanes!inner (platform, name), planning_months!inner (month)";

type SubjectJoin = {
  planning_lanes: { platform: string; name: string } | null;
  planning_months: { month: string } | null;
};

function toSubject(row: unknown): SubjectWithLane {
  const joined = row as SubjectJoin & Record<string, unknown>;
  const { planning_lanes: lane, planning_months: month, ...subject } = joined;

  return {
    ...(subject as unknown as SubjectWithLane),
    platform: (lane?.platform ?? "other") as PlanningPlatform,
    lane_name: lane?.name ?? "",
    month_key: month?.month ?? "",
  };
}

/**
 * Mois disponibles, du plus récent au plus ancien.
 *
 * Les boards d'archive en sont exclus : ils alimentent la déduction de
 * stratégie mais n'ont pas à encombrer un sélecteur de mois.
 */
export async function listMonths(clientId: string): Promise<MonthSummary[]> {
  const supabase = await createClient();

  const [{ data: months }, { data: counts }] = await Promise.all([
    supabase
      .from("planning_months")
      .select("*, planning_boards!inner (name, is_archive)")
      .eq("client_id", clientId)
      .eq("planning_boards.is_archive", false)
      .order("month", { ascending: false }),
    supabase.from("planning_subjects").select("month_id").eq("client_id", clientId),
  ]);

  const countByMonth = new Map<string, number>();
  for (const row of counts ?? []) {
    countByMonth.set(row.month_id, (countByMonth.get(row.month_id) ?? 0) + 1);
  }

  // `Relationships: []` dans le type de la base empêche postgrest-js d'inférer
  // les jointures imbriquées : la forme est décrite ici, comme ailleurs dans le
  // projet, en attendant la génération de types par la CLI Supabase.
  type MonthJoin = PlanningMonth & {
    planning_boards: { name: string } | null;
  };

  return ((months ?? []) as unknown as MonthJoin[]).map(
    ({ planning_boards: board, ...month }) => ({
      ...month,
      board_name: board?.name ?? "",
      subject_count: countByMonth.get(month.id) ?? 0,
    }),
  );
}

export async function listSubjectsOfMonth(
  monthId: string,
): Promise<SubjectWithLane[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("planning_subjects")
    .select(SUBJECT_SELECT)
    .eq("month_id", monthId)
    // Les sujets sans date passent en dernier plutôt que de disparaître.
    .order("scheduled_on", { ascending: true, nullsFirst: false })
    .order("name");

  return (data ?? []).map(toSubject);
}

/**
 * Sujets d'une fenêtre de mois, archives comprises.
 *
 * C'est la matière de la déduction de stratégie : elle a besoin de l'historique
 * long, là où la vue mensuelle ne regarde qu'un mois.
 */
export async function listSubjectsSince(
  clientId: string,
  fromMonth: string,
): Promise<SubjectWithLane[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("planning_subjects")
    .select(SUBJECT_SELECT)
    .eq("client_id", clientId)
    .gte("planning_months.month", fromMonth)
    .order("scheduled_on", { ascending: true, nullsFirst: false });

  return (data ?? []).map(toSubject);
}

export async function getSubject(
  subjectId: string,
): Promise<SubjectWithLane | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("planning_subjects")
    .select(SUBJECT_SELECT)
    .eq("id", subjectId)
    .maybeSingle();

  return data ? toSubject(data) : null;
}

export async function getLastSyncRun(
  clientId: string,
): Promise<PlanningSyncRun | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("planning_sync_runs")
    .select("*")
    .eq("client_id", clientId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as unknown as PlanningSyncRun) ?? null;
}

/** Le mois précédent celui donné, s'il existe dans les données. */
export function previousMonthKey(month: string): string {
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7));
  const date = new Date(Date.UTC(year, index - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
