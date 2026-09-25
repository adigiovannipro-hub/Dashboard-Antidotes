/**
 * Reprise définitive d'une année Monday dans un tableau existant.
 *
 * `importMondayBoard` suppose un tableau vierge : il empile les couloirs Monday
 * à côté de ceux que l'ouverture du client a posés (« Meta », « TikTok »), ne
 * relève pas un mois mis à la corbeille, et laisse les visuels sur des URL
 * Monday protégées — donc illisibles dans Antidotes. La reprise, elle, part
 * d'un tableau **déjà vivant** : elle remplace mois par mois ce que Monday
 * décrit, et seulement ça.
 *
 * Ce fichier ne fait que **décider** : il reçoit l'instantané figé
 * (`scripts/data/reprise-monday/<espace>.json`) et l'état actuel du tableau,
 * et rend la liste des gestes. Le script les exécute. Aucun import Supabase :
 * tout ce qui compte se teste sans base.
 *
 * Les règles :
 *
 *   • un mois est **repris** s'il porte au moins un couloir Monday et n'est pas
 *     exclu — l'exclusion est écrite dans l'instantané (octobre 2026, en
 *     préparation dans Antidotes, ne doit pas bouger) ;
 *   • dans un mois repris, ce qui ne vient pas de Monday part : une ligne vide
 *     ou déjà à la corbeille est effacée pour de bon (ce sont les essais), une
 *     ligne qui porte du contenu va à la corbeille — restaurable, jamais
 *     perdue — et suit le premier couloir Monday du mois, puisque son couloir
 *     d'origine disparaît ;
 *   • un mois repris à la corbeille est relevé : sans ça, l'upsert écrirait
 *     dans un mois invisible (le piège de `createMonth`) ;
 *   • les mois hors reprise ne sont jamais touchés, même vides.
 */

import type { RemoteGroup, RemoteItem, RemoteSubitem } from "./connectors/types";
import {
  deriveColumnMapping,
  normalizeAdStatus,
  normalizeFormat,
  normalizePlatform,
  normalizeStatus,
  parseMonthLabel,
  parseScheduledOn,
  parseSponsoring,
  parseVisualUrls,
} from "./monday-mapping";
import type { ColumnMapping, MondayColumn } from "./monday-mapping";
import type { PlanningFormat, PlanningPlatform, PlanningStatus } from "./types";

// --- Instantané ---------------------------------------------------------------

export type RepriseUpdate = {
  id: string;
  body: string;
  creator: string | null;
  createdAt: string | null;
};

export type RepriseSubitem = RemoteSubitem & { updates?: RepriseUpdate[] };

export type RepriseSnapshot = {
  workspace: string;
  year: number;
  /** Mois à ne jamais toucher, `YYYY-MM-01`. */
  excludedMonths: string[];
  capturedAt: string;
  board: { id: string; name: string; url: string | null };
  subitemBoardId: string | null;
  subitemColumns: MondayColumn[];
  groups: RemoteGroup[];
  items: (Omit<RemoteItem, "subitems"> & { subitems: RepriseSubitem[] })[];
};

// --- État actuel du tableau ---------------------------------------------------

export type ExistingMonth = { id: string; month: string; deleted_at: string | null };

export type ExistingLane = {
  id: string;
  month_id: string;
  external_id: string | null;
};

export type ExistingSubject = {
  id: string;
  month_id: string;
  lane_id: string;
  external_id: string | null;
  name: string;
  wording: string | null;
  visual_urls: string[];
  deleted_at: string | null;
};

// --- Plan ---------------------------------------------------------------------

/** Un fichier Monday, repéré par son identifiant d'asset. */
export type MondayFile = {
  assetId: string;
  name: string;
};

export type LaneDraft = {
  externalId: string;
  month: string;
  name: string;
  platform: PlanningPlatform;
  position: number;
};

export type SubjectDraft = {
  externalId: string;
  laneExternalId: string;
  month: string;
  name: string;
  status: PlanningStatus;
  format: PlanningFormat;
  scheduledOn: string | null;
  wording: string | null;
  sponsoring: number | null;
  adObjective: string | null;
  adStatus: "todo" | "doing" | "done" | "blocked" | null;
  position: number;
  comments: string | null;
  ok: boolean;
  ownerName: string | null;
  files: MondayFile[];
  updates: RepriseUpdate[];
};

export type ReprisePlan = {
  /** Mois repris, dans l'ordre du calendrier. */
  months: { month: string; existingId: string | null; restore: boolean }[];
  lanes: LaneDraft[];
  subjects: SubjectDraft[];
  /** Essais et lignes déjà à la corbeille : effacés pour de bon. */
  deleteSubjectIds: string[];
  /** Contenu saisi hors Monday : à la corbeille, déplacé sur un couloir Monday. */
  trashSubjects: { id: string; month: string }[];
  /** Couloirs hors Monday des mois repris — vides une fois le ménage fait. */
  deleteLaneIds: string[];
  /** Fichiers au bucket des lignes effacées pour de bon. */
  orphanVisualPaths: string[];
  /** Groupes Monday qui ne sont pas des mois (« CAMPAGNE DARK ADS »). */
  skippedGroups: string[];
  warnings: string[];
};

// --- Lecture des valeurs --------------------------------------------------------

function valueOf(subitem: RemoteSubitem, columnId: string | null): string | null {
  if (!columnId) return null;
  const raw = subitem.columnValues[columnId];
  if (raw === null || raw === undefined) return null;
  return raw.length > 0 ? raw : null;
}

/**
 * `https://…/resources/<asset>/<nom>` → asset et nom décodé.
 *
 * Un même asset posé deux fois sur une ligne (vu sur un carrousel Bondet
 * d'août) n'en fait qu'un : deux entrées au même chemin casseraient la clé
 * de rendu du carrousel, et Instagram publierait deux fois la même image.
 */
export function parseMondayFiles(raw: string | null): MondayFile[] {
  const seen = new Set<string>();
  const files: MondayFile[] = [];

  for (const url of parseVisualUrls(raw)) {
    const match = /\/resources\/(\d+)\/([^/?#]+)/.exec(url);
    if (!match) continue;
    const assetId = match[1]!;
    if (seen.has(assetId)) continue;
    seen.add(assetId);

    let name = match[2]!;
    try {
      name = decodeURIComponent(name);
    } catch {
      // Nom mal encodé : on garde la forme brute plutôt que de perdre le fichier.
    }
    files.push({ assetId, name });
  }

  return files;
}

function isEmptySubject(subject: ExistingSubject): boolean {
  return (
    subject.name.trim().length === 0 &&
    (subject.wording ?? "").trim().length === 0 &&
    subject.visual_urls.length === 0
  );
}

// --- Plan ---------------------------------------------------------------------

export function planReprise(input: {
  snapshot: RepriseSnapshot;
  months: ExistingMonth[];
  lanes: ExistingLane[];
  subjects: ExistingSubject[];
}): ReprisePlan {
  const { snapshot } = input;
  const mapping: ColumnMapping = deriveColumnMapping(snapshot.subitemColumns);
  const excluded = new Set(snapshot.excludedMonths);
  const warnings: string[] = [];
  const skippedGroups: string[] = [];

  // Colonnes sans champ du modèle : repérées par leur titre, comme le reste.
  const okColumn =
    snapshot.subitemColumns.find(
      (column) => column.type === "checkbox" && column.title.trim().toUpperCase() === "OK",
    )?.id ?? null;

  const monthByGroup = new Map<string, string>();
  for (const group of snapshot.groups) {
    const month = parseMonthLabel(group.title, snapshot.year);
    if (month === null) {
      skippedGroups.push(group.title);
      continue;
    }
    if (!excluded.has(month)) monthByGroup.set(group.id, month);
  }

  const lanes: LaneDraft[] = [];
  const subjects: SubjectDraft[] = [];
  const lanePositionByMonth = new Map<string, number>();

  const items = [...snapshot.items].sort((a, b) => a.position - b.position);
  for (const item of items) {
    const month = monthByGroup.get(item.groupId);
    if (!month) continue;

    const position = lanePositionByMonth.get(month) ?? 0;
    lanePositionByMonth.set(month, position + 1);

    lanes.push({
      externalId: item.id,
      month,
      name: item.name,
      platform: normalizePlatform(item.name),
      position,
    });

    item.subitems.forEach((subitem, index) => {
      const statusRaw = valueOf(subitem, mapping.status);
      const status = normalizeStatus(statusRaw);
      if (statusRaw && status === "idea") {
        warnings.push(`Statut inconnu « ${statusRaw} » sur « ${subitem.name} »`);
      }

      const formatRaw = valueOf(subitem, mapping.format);
      const format = normalizeFormat(formatRaw);
      if (formatRaw && format === "other") {
        warnings.push(`Format inconnu « ${formatRaw} » sur « ${subitem.name} »`);
      }

      const adStatusRaw = valueOf(subitem, mapping.adStatus);
      const adStatus = normalizeAdStatus(adStatusRaw);
      if (adStatusRaw && adStatus === null) {
        warnings.push(`Statut ads inconnu « ${adStatusRaw} » sur « ${subitem.name} »`);
      }

      subjects.push({
        externalId: subitem.id,
        laneExternalId: item.id,
        month,
        name: subitem.name,
        status,
        format,
        scheduledOn: parseScheduledOn(valueOf(subitem, mapping.date)),
        // Le wording est repris tel quel, à l'octet : c'est un texte publié.
        wording: valueOf(subitem, mapping.wording),
        sponsoring: parseSponsoring(valueOf(subitem, mapping.sponsoring)),
        adObjective: valueOf(subitem, mapping.objective),
        adStatus,
        position: index,
        comments: valueOf(subitem, mapping.comments),
        ok: valueOf(subitem, okColumn) !== null,
        ownerName: valueOf(subitem, mapping.owner),
        files: parseMondayFiles(valueOf(subitem, mapping.visual)),
        updates: subitem.updates ?? [],
      });
    });
  }

  const repriseMonths = [...new Set(lanes.map((lane) => lane.month))].sort();
  const existingByMonth = new Map(input.months.map((row) => [row.month, row]));

  const months = repriseMonths.map((month) => {
    const existing = existingByMonth.get(month);
    return {
      month,
      existingId: existing?.id ?? null,
      restore: Boolean(existing?.deleted_at),
    };
  });

  // --- Ménage des mois repris ---
  const monthKeyById = new Map(input.months.map((row) => [row.id, row.month]));
  const inReprise = (monthId: string) => {
    const key = monthKeyById.get(monthId);
    return key !== undefined && repriseMonths.includes(key);
  };

  const deleteSubjectIds: string[] = [];
  const trashSubjects: { id: string; month: string }[] = [];
  const orphanVisualPaths: string[] = [];

  for (const subject of input.subjects) {
    if (subject.external_id !== null || !inReprise(subject.month_id)) continue;

    if (subject.deleted_at !== null || isEmptySubject(subject)) {
      deleteSubjectIds.push(subject.id);
      orphanVisualPaths.push(
        ...subject.visual_urls.filter((entry) => !entry.startsWith("http")),
      );
    } else {
      trashSubjects.push({ id: subject.id, month: monthKeyById.get(subject.month_id)! });
    }
  }

  const deleteLaneIds = input.lanes
    .filter((lane) => lane.external_id === null && inReprise(lane.month_id))
    .map((lane) => lane.id);

  const duplicates = subjects.length - new Set(subjects.map((s) => s.externalId)).size;
  if (duplicates > 0) warnings.push(`${duplicates} sous-élément(s) en double dans l'instantané`);

  return {
    months,
    lanes,
    subjects,
    deleteSubjectIds,
    trashSubjects,
    deleteLaneIds,
    orphanVisualPaths,
    skippedGroups,
    warnings,
  };
}

/** Ce qu'une publication reprise ferait partir toute seule — à dire, pas à taire. */
export function wouldAutoPublish(subject: SubjectDraft, today: string): boolean {
  return (
    subject.status === "validated" &&
    subject.format !== "story" &&
    subject.scheduledOn !== null &&
    subject.scheduledOn >= today
  );
}
