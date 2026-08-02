/**
 * Reprise d'une année depuis Monday.
 *
 * Sert une fois par tableau : récupérer ce qui a déjà été saisi plutôt que de
 * le retaper. Après quoi le tableau du dashboard fait autorité et Monday n'est
 * plus interrogé — rien ne réécrit dans l'autre sens, et il n'y a donc jamais
 * deux vérités à réconcilier.
 *
 * L'import est **rejouable** : les identifiants Monday sont conservés dans
 * `external_id`, ce qui transforme une seconde passe en mise à jour. Une
 * publication créée à la main dans le dashboard, elle, n'a pas d'`external_id`
 * et ne sera jamais écrasée.
 *
 * Pas de `server-only` : ce fichier tourne dans le job `pnpm import:monday`, et
 * le marqueur lève à l'import depuis un script Node.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import type { PlanningConnector } from "./connectors/types";
import {
  deriveColumnMapping,
  normalizeAdStatus,
  normalizeFormat,
  normalizePlatform,
  normalizeStatus,
  parseBoardName,
  parseMonthLabel,
  parseScheduledOn,
  parseSponsoring,
  parseVisualUrls,
} from "./monday-mapping";
import type { ColumnMapping } from "./monday-mapping";

type Admin = SupabaseClient<Database>;

export type ImportReport = {
  months: number;
  lanes: number;
  subjects: number;
  skippedGroups: string[];
};

function valueOf(
  values: Record<string, string | null>,
  columnId: string | null,
): string | null {
  return columnId ? (values[columnId] ?? null) : null;
}

export async function importMondayBoard(input: {
  admin: Admin;
  connector: PlanningConnector;
  /** Board Monday source. */
  mondayBoardId: string;
  /** Tableau de destination, déjà créé dans l'espace. */
  boardId: string;
  workspaceId: string;
  /** Année du planning ; déduite du nom du board Monday si absente. */
  year?: number;
}): Promise<ImportReport> {
  const snapshot = await input.connector.fetchBoard(input.mondayBoardId);
  const mapping: ColumnMapping = deriveColumnMapping(snapshot.subitemColumns);

  const year =
    input.year ?? parseBoardName(snapshot.board.name)?.year ?? new Date().getFullYear();

  const report: ImportReport = {
    months: 0,
    lanes: 0,
    subjects: 0,
    skippedGroups: [],
  };

  // --- Mois ---
  // Les groupes qui ne sont pas des mois (« IDÉES », « À CLASSER ») sont
  // écartés et signalés : les taire laisserait croire à un import complet.
  const months = snapshot.groups
    .map((group) => ({ group, month: parseMonthLabel(group.title, year) }))
    .filter((entry) => {
      if (entry.month === null) report.skippedGroups.push(entry.group.title);
      return entry.month !== null;
    }) as { group: (typeof snapshot.groups)[number]; month: string }[];

  if (months.length === 0) return report;

  await input.admin.from("planning_months").upsert(
    months.map((entry) => ({
      board_id: input.boardId,
      workspace_id: input.workspaceId,
      label: entry.group.title,
      month: entry.month,
      position: entry.group.position,
    })),
    { onConflict: "board_id,month" },
  );
  report.months = months.length;

  const { data: monthRows } = await input.admin
    .from("planning_months")
    .select("id, month")
    .eq("board_id", input.boardId);

  const monthIdByKey = new Map((monthRows ?? []).map((row) => [row.month, row.id]));
  const monthIdByGroup = new Map(
    months
      .map((entry) => [entry.group.id, monthIdByKey.get(entry.month)] as const)
      .filter((pair): pair is readonly [string, string] => Boolean(pair[1])),
  );

  // --- Couloirs ---
  const lanes = snapshot.items
    .map((item) => ({ item, monthId: monthIdByGroup.get(item.groupId) }))
    .filter(
      (entry): entry is { item: (typeof snapshot.items)[number]; monthId: string } =>
        entry.monthId !== undefined,
    );

  if (lanes.length === 0) return report;

  await input.admin.from("planning_lanes").upsert(
    lanes.map((entry) => ({
      month_id: entry.monthId,
      board_id: input.boardId,
      workspace_id: input.workspaceId,
      platform: normalizePlatform(entry.item.name),
      name: entry.item.name,
      position: entry.item.position,
      external_id: entry.item.id,
    })),
    { onConflict: "board_id,external_id" },
  );
  report.lanes = lanes.length;

  const { data: laneRows } = await input.admin
    .from("planning_lanes")
    .select("id, external_id")
    .eq("board_id", input.boardId)
    .not("external_id", "is", null);

  const laneIdByExternal = new Map(
    (laneRows ?? []).map((row) => [row.external_id, row.id]),
  );

  // --- Publications ---
  const subjects = lanes.flatMap((entry) => {
    const laneId = laneIdByExternal.get(entry.item.id);
    if (!laneId) return [];

    return entry.item.subitems.map((subitem, index) => {
      const values = subitem.columnValues;

      return {
        lane_id: laneId,
        month_id: entry.monthId,
        board_id: input.boardId,
        workspace_id: input.workspaceId,
        name: subitem.name,
        status: normalizeStatus(valueOf(values, mapping.status)),
        format: normalizeFormat(valueOf(values, mapping.format)),
        scheduled_on: parseScheduledOn(valueOf(values, mapping.date)),
        wording: valueOf(values, mapping.wording),
        sponsoring: parseSponsoring(valueOf(values, mapping.sponsoring)),
        ad_objective: valueOf(values, mapping.objective),
        ad_status: normalizeAdStatus(valueOf(values, mapping.adStatus)),
        // Les visuels restent des URL Monday : les rapatrier dans le bucket
        // demanderait de les télécharger un à un, ce que l'import ne fait pas.
        visual_urls: parseVisualUrls(valueOf(values, mapping.visual)),
        position: index,
        external_id: subitem.id,
      };
    });
  });

  if (subjects.length > 0) {
    // `owner_id` est volontairement absent : les comptes Monday ne sont pas les
    // comptes de la plateforme, et deviner la correspondance sur un nom
    // affecterait des publications à la mauvaise personne.
    await input.admin
      .from("planning_subjects")
      .upsert(subjects, { onConflict: "board_id,external_id" });
    report.subjects = subjects.length;
  }

  return report;
}
