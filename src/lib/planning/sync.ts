/**
 * Synchronisation Monday → Antidotes, et retour du seul wording.
 *
 * Pas de `server-only` ici, contrairement au reste du module : ce fichier
 * tourne aussi bien dans une action serveur que dans le job `pnpm
 * sync:planning`, et le marqueur lève à l'import depuis un script Node. La
 * protection reste entière par ailleurs — le client Supabase et le jeton
 * Monday sont injectés par l'appelant, ce module n'en lit aucun.
 *
 * Le pull est intégral et idempotent : il recopie boards, groupes, éléments et
 * sous-éléments, et peut se rejouer sans créer de doublon. Les identifiants
 * Monday servent de clés de conflit, ce qui rend la reprise après erreur
 * gratuite.
 *
 * Le push, lui, est étroit par construction — voir `WRITABLE_FIELDS`. Il ne
 * part jamais tout seul : seul un sujet dont le wording a été explicitement mis
 * en file d'attente est renvoyé.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import type { PlanningConnector } from "./connectors/types";
import {
  assertWritableField,
  deriveColumnMapping,
  normalizeFormat,
  normalizePlatform,
  normalizeStatus,
  parseBoardName,
  parseMonthLabel,
  parseScheduledOn,
  parseSponsoring,
  parseVisualUrls,
} from "./monday-mapping";
import type { ColumnMapping, PlanningStatus } from "./types";

type Admin = SupabaseClient<Database>;

export type SyncReport = {
  boardsSeen: number;
  monthsUpserted: number;
  lanesUpserted: number;
  subjectsUpserted: number;
};

const EMPTY_REPORT: SyncReport = {
  boardsSeen: 0,
  monthsUpserted: 0,
  lanesUpserted: 0,
  subjectsUpserted: 0,
};

function valueOf(
  columnValues: Record<string, string | null>,
  columnId: string | null,
): string | null {
  return columnId ? (columnValues[columnId] ?? null) : null;
}

// --- Pull -------------------------------------------------------------------

/**
 * Recopie un board dans la base.
 *
 * Le mapping des colonnes est déduit à la première synchronisation puis
 * conservé : une correction manuelle ne doit pas être écrasée à la
 * synchronisation suivante.
 */
export async function pullBoard(input: {
  admin: Admin;
  connector: PlanningConnector;
  clientId: string;
  boardRowId: string;
  mondayBoardId: string;
  year: number | null;
  columnMapping: ColumnMapping | null;
  statusMapping: Record<string, PlanningStatus>;
}): Promise<SyncReport> {
  const snapshot = await input.connector.fetchBoard(input.mondayBoardId);

  const hasMapping =
    input.columnMapping !== null &&
    Object.values(input.columnMapping).some((value) => value !== null);
  const mapping = hasMapping
    ? input.columnMapping!
    : deriveColumnMapping(snapshot.subitemColumns);

  const year = input.year ?? parseBoardName(snapshot.board.name)?.year ?? null;

  await input.admin
    .from("planning_boards")
    .update({
      name: snapshot.board.name,
      url: snapshot.board.url,
      monday_subitem_board_id: snapshot.subitemBoardId,
      column_mapping: mapping as unknown as Record<string, string | null>,
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", input.boardRowId);

  const report = { ...EMPTY_REPORT, boardsSeen: 1 };
  if (year === null) return report;

  // --- Mois ---
  // Les groupes qui ne sont pas des mois (« IDÉES », « À CLASSER ») sont
  // écartés : ils n'ont pas de place dans un calendrier.
  const months = snapshot.groups
    .map((group) => ({
      group,
      month: parseMonthLabel(group.title, year),
    }))
    .filter(
      (entry): entry is { group: (typeof snapshot.groups)[number]; month: string } =>
        entry.month !== null,
    );

  if (months.length === 0) return report;

  await input.admin.from("planning_months").upsert(
    months.map((entry) => ({
      board_id: input.boardRowId,
      client_id: input.clientId,
      monday_group_id: entry.group.id,
      label: entry.group.title,
      month: entry.month,
      position: entry.group.position,
    })),
    { onConflict: "board_id,monday_group_id" },
  );
  report.monthsUpserted = months.length;

  const { data: monthRows } = await input.admin
    .from("planning_months")
    .select("id, monday_group_id")
    .eq("board_id", input.boardRowId);

  const monthIdByGroup = new Map(
    (monthRows ?? []).map((row) => [row.monday_group_id, row.id]),
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
      client_id: input.clientId,
      monday_item_id: entry.item.id,
      platform: normalizePlatform(entry.item.name),
      name: entry.item.name,
      position: entry.item.position,
    })),
    { onConflict: "monday_item_id" },
  );
  report.lanesUpserted = lanes.length;

  const { data: laneRows } = await input.admin
    .from("planning_lanes")
    .select("id, monday_item_id")
    .in(
      "monday_item_id",
      lanes.map((entry) => entry.item.id),
    );

  const laneIdByItem = new Map(
    (laneRows ?? []).map((row) => [row.monday_item_id, row.id]),
  );

  // --- Sujets ---
  const subjects = lanes.flatMap((entry) => {
    const laneId = laneIdByItem.get(entry.item.id);
    if (!laneId) return [];

    return entry.item.subitems.map((subitem) => {
      const values = subitem.columnValues;
      const statusRaw = valueOf(values, mapping.status);
      const formatRaw = valueOf(values, mapping.format);

      return {
        lane_id: laneId,
        month_id: entry.monthId,
        client_id: input.clientId,
        monday_item_id: subitem.id,
        name: subitem.name,
        format: normalizeFormat(formatRaw),
        format_raw: formatRaw,
        scheduled_on: parseScheduledOn(valueOf(values, mapping.date)),
        status: normalizeStatus(statusRaw, input.statusMapping),
        status_raw: statusRaw,
        wording: valueOf(values, mapping.wording),
        comments: valueOf(values, mapping.comments),
        sponsoring: parseSponsoring(valueOf(values, mapping.sponsoring)),
        objective: valueOf(values, mapping.objective),
        owner_name: valueOf(values, mapping.owner),
        visual_urls: parseVisualUrls(valueOf(values, mapping.visual)),
        permalink: subitem.url,
        monday_updated_at: subitem.updatedAt,
        synced_at: new Date().toISOString(),
      };
    });
  });

  if (subjects.length > 0) {
    // `pending_wording` est volontairement absent de la charge : une écriture
    // locale en attente de push ne doit pas être effacée par un pull.
    await input.admin
      .from("planning_subjects")
      .upsert(subjects, { onConflict: "monday_item_id" });
    report.subjectsUpserted = subjects.length;
  }

  return report;
}

/** Synchronise tous les boards d'un client, et journalise le run. */
export async function pullClient(input: {
  admin: Admin;
  connector: PlanningConnector;
  clientId: string;
  /** Les archives ne sont utiles qu'à la déduction de stratégie. */
  includeArchives?: boolean;
}): Promise<SyncReport> {
  const { data: run } = await input.admin
    .from("planning_sync_runs")
    .insert({ client_id: input.clientId, direction: "pull", status: "running" })
    .select("id")
    .single();

  const total = { ...EMPTY_REPORT };

  try {
    let query = input.admin
      .from("planning_boards")
      .select("id, monday_board_id, year, column_mapping, status_mapping")
      .eq("client_id", input.clientId);

    if (!input.includeArchives) query = query.eq("is_archive", false);

    const { data: boards } = await query;

    for (const board of boards ?? []) {
      const report = await pullBoard({
        admin: input.admin,
        connector: input.connector,
        clientId: input.clientId,
        boardRowId: board.id,
        mondayBoardId: board.monday_board_id,
        year: board.year,
        columnMapping: board.column_mapping as unknown as ColumnMapping | null,
        statusMapping: (board.status_mapping ?? {}) as Record<string, PlanningStatus>,
      });

      total.boardsSeen += report.boardsSeen;
      total.monthsUpserted += report.monthsUpserted;
      total.lanesUpserted += report.lanesUpserted;
      total.subjectsUpserted += report.subjectsUpserted;
    }

    if (run) {
      await input.admin
        .from("planning_sync_runs")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          boards_seen: total.boardsSeen,
          subjects_upserted: total.subjectsUpserted,
        })
        .eq("id", run.id);
    }

    return total;
  } catch (error) {
    if (run) {
      await input.admin
        .from("planning_sync_runs")
        .update({
          status: "error",
          finished_at: new Date().toISOString(),
          error: (error as Error).message,
        })
        .eq("id", run.id);
    }
    throw error;
  }
}

// --- Push -------------------------------------------------------------------

export type PushReport = {
  pushed: number;
  failed: { subjectId: string; error: string }[];
};

/**
 * Renvoie dans Monday les wordings mis en file d'attente.
 *
 * `assertWritableField` est appelé alors même que le champ est écrit en dur
 * deux lignes plus haut. C'est délibéré : le jour où quelqu'un rendra ce champ
 * paramétrable, la garde sera déjà là.
 */
export async function pushPendingWording(input: {
  admin: Admin;
  connector: PlanningConnector;
  clientId: string;
  /** Restreint le push à un sujet précis. */
  subjectId?: string;
}): Promise<PushReport> {
  assertWritableField("wording");

  let query = input.admin
    .from("planning_subjects")
    .select("id, monday_item_id, pending_wording, month_id")
    .eq("client_id", input.clientId)
    .not("pending_wording", "is", null);

  if (input.subjectId) query = query.eq("id", input.subjectId);

  const { data: pending } = await query;
  if (!pending || pending.length === 0) return { pushed: 0, failed: [] };

  // Le board porte à la fois l'identifiant du board de sous-éléments et le
  // mapping : une seule requête pour les deux, indexée par mois.
  const { data: months } = await input.admin
    .from("planning_months")
    .select("id, planning_boards (monday_subitem_board_id, column_mapping)")
    .in(
      "id",
      pending.map((subject) => subject.month_id),
    );

  type BoardInfo = {
    monday_subitem_board_id: string | null;
    column_mapping: Record<string, string | null>;
  };
  type MonthJoin = { id: string; planning_boards: BoardInfo | null };

  const boardByMonth = new Map(
    ((months ?? []) as unknown as MonthJoin[]).map((row) => [
      row.id,
      row.planning_boards,
    ]),
  );

  const report: PushReport = { pushed: 0, failed: [] };

  for (const subject of pending) {
    const board = boardByMonth.get(subject.month_id);
    const columnId = board?.column_mapping?.wording ?? null;

    if (!board?.monday_subitem_board_id || !columnId) {
      report.failed.push({
        subjectId: subject.id,
        error: "Board de sous-éléments ou colonne Wording inconnus.",
      });
      continue;
    }

    try {
      await input.connector.updateColumnValue({
        boardId: board.monday_subitem_board_id,
        itemId: subject.monday_item_id,
        columnId,
        value: subject.pending_wording ?? "",
      });

      await input.admin
        .from("planning_subjects")
        .update({
          wording: subject.pending_wording,
          pending_wording: null,
          pending_since: null,
          pushed_at: new Date().toISOString(),
        })
        .eq("id", subject.id);

      report.pushed += 1;
    } catch (error) {
      report.failed.push({ subjectId: subject.id, error: (error as Error).message });
    }
  }

  return report;
}

// --- Découverte -------------------------------------------------------------

/**
 * Recense les boards « CLIENT I PE ANNÉE » et crée ce qui manque.
 *
 * Les boards hors convention de nommage sont ignorés en silence : un board
 * « FAQ MODÉRATION » ou « PIPELINE » n'a rien à faire dans un planning éditorial.
 */
export async function discoverBoards(input: {
  admin: Admin;
  connector: PlanningConnector;
  orgId: string;
}): Promise<{ clients: number; boards: number }> {
  const boards = await input.connector.listBoards("PE");
  const parsed = boards
    .map((board) => ({ board, parsed: parseBoardName(board.name) }))
    .filter(
      (entry): entry is { board: BoardSummaryLike; parsed: ParsedBoardName } =>
        entry.parsed !== null,
    );

  const created = { clients: 0, boards: 0 };

  for (const entry of parsed) {
    const slug = slugFor(entry.parsed.clientName);

    const { data: existing } = await input.admin
      .from("planning_clients")
      .select("id")
      .eq("org_id", input.orgId)
      .eq("slug", slug)
      .maybeSingle();

    let clientId = existing?.id;

    if (!clientId) {
      const { data: inserted } = await input.admin
        .from("planning_clients")
        .insert({
          org_id: input.orgId,
          slug,
          name: titleCase(entry.parsed.clientName),
        })
        .select("id")
        .single();
      clientId = inserted?.id;
      if (clientId) created.clients += 1;
    }

    if (!clientId) continue;

    const { error } = await input.admin.from("planning_boards").upsert(
      {
        client_id: clientId,
        monday_board_id: entry.board.id,
        name: entry.board.name,
        year: entry.parsed.year,
        url: entry.board.url,
        is_archive: entry.parsed.isArchive,
      },
      { onConflict: "client_id,monday_board_id" },
    );
    if (!error) created.boards += 1;
  }

  return created;
}

type BoardSummaryLike = { id: string; name: string; url: string | null };
type ParsedBoardName = NonNullable<ReturnType<typeof parseBoardName>>;

function slugFor(clientName: string): string {
  return clientName
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** `LUNETTES BONDET` → `Lunettes Bondet`, plus lisible dans la navigation. */
function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|[\s-])([a-zà-ÿ])/g, (_, prefix: string, letter: string) =>
      `${prefix}${letter.toUpperCase()}`,
    );
}
