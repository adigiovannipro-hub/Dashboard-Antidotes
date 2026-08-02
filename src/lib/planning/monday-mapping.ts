/**
 * Normalisation du vocabulaire Monday vers le modèle canonique.
 *
 * Les boards PE se ressemblent sans être identiques. Ce qui varie réellement,
 * constaté sur les boards en production :
 *
 *   • une colonne `Commentaires` chez un client, absente chez un autre ;
 *   • sept libellés de `Thématique` chez l'un, trois chez l'autre ;
 *   • des `Objectifs` différents (`Traffic` ici, `Followers` là) ;
 *   • des groupes de mois qui ne s'écrivent même pas pareil — « AOUT » contre
 *     « AOÛT ».
 *
 * D'où la règle : rien de tout cela n'est en dur. Le mapping est déduit à la
 * découverte du board, stocké en base, et corrigeable à la main.
 */

import type {
  ColumnMapping,
  PlanningFormat,
  PlanningPlatform,
  PlanningStatus,
} from "./types";

/** Casse et accents écartés : « PUBLIÉ », « publie » et « Publié » convergent. */
export function normalizeLabel(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

// --- Mois -------------------------------------------------------------------

const MONTH_NAMES = [
  "JANVIER",
  "FEVRIER",
  "MARS",
  "AVRIL",
  "MAI",
  "JUIN",
  "JUILLET",
  "AOUT",
  "SEPTEMBRE",
  "OCTOBRE",
  "NOVEMBRE",
  "DECEMBRE",
];

/**
 * Libellé de groupe Monday → premier jour du mois, `YYYY-MM-01`.
 *
 * Le libellé seul ne suffit pas : il ne porte pas l'année, qui vient du board.
 * Renvoie `null` pour un groupe qui n'est pas un mois — les boards contiennent
 * parfois des groupes de travail (« IDÉES », « À CLASSER ») qu'il ne faut pas
 * confondre avec le planning.
 */
export function parseMonthLabel(
  label: string,
  year: number,
): string | null {
  const normalized = normalizeLabel(label);
  const index = MONTH_NAMES.indexOf(normalized);
  if (index === -1) return null;
  return `${year}-${String(index + 1).padStart(2, "0")}-01`;
}

export function monthLabel(month: string): string {
  const index = Number(month.slice(5, 7)) - 1;
  const name = MONTH_NAMES[index] ?? "";
  return `${name.charAt(0)}${name.slice(1).toLowerCase()} ${month.slice(0, 4)}`;
}

// --- Nom de board -----------------------------------------------------------

/**
 * `LUNETTES BONDET I PE 2026` → client, année, archive.
 *
 * La convention de nommage est « CLIENT I PE ANNÉE », le séparateur étant un
 * i majuscule isolé. Un nom de client peut lui-même contenir un « I » collé
 * (`I-WAY`), d'où le `\s+I\s+` qui exige les espaces.
 */
export function parseBoardName(name: string): {
  clientName: string;
  year: number | null;
  isArchive: boolean;
} | null {
  const match = /^(.*?)\s+I\s+PE\s+(\d{4})\s*(\[ARCHIVE\])?\s*$/i.exec(name.trim());
  if (!match) return null;
  return {
    clientName: match[1]!.trim(),
    year: Number(match[2]),
    isArchive: Boolean(match[3]),
  };
}

/** `LUNETTES BONDET` → `lunettes-bondet`. */
export function slugifyClientName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// --- Statuts ----------------------------------------------------------------

const STATUS_BY_LABEL: Record<string, PlanningStatus> = {
  "EN COURS": "in_progress",
  PUBLIE: "published",
  "A VALIDER": "to_validate",
  VALIDE: "validated",
  "EN ATTENTE": "on_hold",
  "NON RETENU": "dropped",
  "WORDING A FAIRE": "wording_todo",
  PROGRAMME: "scheduled",
  "EN BROUILLON": "draft",
};

/**
 * Libellé Monday → statut canonique.
 *
 * `overrides` porte le mapping propre au board, pour un client qui aurait
 * renommé ses statuts. Un libellé inconnu retombe sur `idea` : le sujet existe,
 * on ne sait juste rien de son avancement. Son libellé d'origine est conservé
 * en base à côté, et c'est lui que l'interface affiche.
 */
export function normalizeStatus(
  raw: string | null | undefined,
  overrides: Record<string, PlanningStatus> = {},
): PlanningStatus {
  const key = normalizeLabel(raw);
  if (!key) return "idea";
  return overrides[key] ?? STATUS_BY_LABEL[key] ?? "idea";
}

// --- Formats ----------------------------------------------------------------

const FORMAT_BY_LABEL: Record<string, PlanningFormat> = {
  REELS: "reel",
  REEL: "reel",
  POST: "post",
  POSTS: "post",
  STORIE: "story",
  STORIES: "story",
  STORY: "story",
  CARROUSEL: "carousel",
  CAROUSEL: "carousel",
  THREAD: "thread",
  VIDEO: "video",
  DARK: "dark",
};

export function normalizeFormat(raw: string | null | undefined): PlanningFormat {
  return FORMAT_BY_LABEL[normalizeLabel(raw)] ?? "other";
}

// --- Plateformes ------------------------------------------------------------

const PLATFORM_BY_LABEL: Record<string, PlanningPlatform> = {
  META: "meta",
  INSTAGRAM: "instagram",
  IG: "instagram",
  FACEBOOK: "facebook",
  FB: "facebook",
  LINKEDIN: "linkedin",
  "LINKED IN": "linkedin",
  TIKTOK: "tiktok",
  "TIK TOK": "tiktok",
  YOUTUBE: "youtube",
  YT: "youtube",
  X: "x",
  TWITTER: "x",
  DARK: "dark",
};

/** Nom de l'élément parent → plateforme du couloir. */
export function normalizePlatform(
  name: string | null | undefined,
): PlanningPlatform {
  return PLATFORM_BY_LABEL[normalizeLabel(name)] ?? "other";
}

// --- Colonnes ---------------------------------------------------------------

export type MondayColumn = {
  id: string;
  title: string;
  type: string;
};

export const EMPTY_COLUMN_MAPPING: ColumnMapping = {
  status: null,
  format: null,
  date: null,
  wording: null,
  comments: null,
  sponsoring: null,
  objective: null,
  owner: null,
  visual: null,
};

/**
 * Titre de colonne → champ canonique.
 *
 * Le titre plutôt que l'identifiant : c'est ce que l'utilisateur voit et
 * maintient. Les identifiants Monday sont des restes d'historique (`texte5`,
 * `dup__of_status`) qui ne survivent pas toujours à la duplication d'un board.
 */
const FIELD_BY_TITLE: Record<string, keyof ColumnMapping> = {
  STATUS: "status",
  STATUT: "status",
  THEMATIQUE: "format",
  FORMAT: "format",
  DATE: "date",
  WORDING: "wording",
  COMMENTAIRES: "comments",
  SPONSORISATION: "sponsoring",
  OBJECTIFS: "objective",
  PROPRIETAIRE: "owner",
  VISUEL: "visual",
};

/**
 * Repli par identifiant, pour un board dont une colonne aurait été renommée.
 * Ces identifiants sont ceux observés sur les boards en production.
 */
const FIELD_BY_ID: Record<string, keyof ColumnMapping> = {
  status: "status",
  dup__of_status: "format",
  date0: "date",
  texte5: "wording",
  chiffres: "sponsoring",
  statut: "objective",
  person: "owner",
  fichier: "visual",
};

/**
 * Déduit le mapping d'un board à partir de ses colonnes de sous-éléments.
 *
 * `Statut Ads` ne doit surtout pas atterrir sur `status` : la correspondance par
 * titre est donc exacte, jamais partielle. Une colonne absente reste à `null`,
 * ce qui est une information — « ce board n'a pas de Commentaires » — et non un
 * oubli de configuration.
 */
export function deriveColumnMapping(columns: MondayColumn[]): ColumnMapping {
  const mapping: ColumnMapping = { ...EMPTY_COLUMN_MAPPING };

  for (const column of columns) {
    const field = FIELD_BY_TITLE[normalizeLabel(column.title)];
    if (field && mapping[field] === null) mapping[field] = column.id;
  }

  for (const column of columns) {
    const field = FIELD_BY_ID[column.id];
    if (field && mapping[field] === null) mapping[field] = column.id;
  }

  return mapping;
}

// --- Liste blanche d'écriture ----------------------------------------------

/**
 * Les seuls champs qu'Antidotes réécrit dans Monday.
 *
 * `Status`, `Visuel`, `Propriétaire`, `Date`, `Thématique` et `OK client`
 * appartiennent au board et à la validation client. Les toucher depuis ici
 * ferait diverger deux outils sur la seule information qui compte vraiment :
 * ce qui est validé et ce qui ne l'est pas.
 */
export const WRITABLE_FIELDS = ["wording", "comments"] as const;

export type WritableField = (typeof WRITABLE_FIELDS)[number];

export function isWritableField(field: string): field is WritableField {
  return (WRITABLE_FIELDS as readonly string[]).includes(field);
}

/**
 * Garde-fou du push. Toute tentative d'écriture hors liste blanche lève, plutôt
 * que d'être silencieusement ignorée : une erreur bruyante vaut mieux qu'un
 * statut client écrasé sans que personne ne s'en aperçoive.
 */
export function assertWritableField(field: string): asserts field is WritableField {
  if (!isWritableField(field)) {
    throw new Error(
      `Colonne « ${field} » non modifiable depuis Antidotes : ` +
        `seuls ${WRITABLE_FIELDS.join(" et ")} le sont.`,
    );
  }
}

/** Identifiants de colonne Monday réellement modifiables sur ce board. */
export function writableColumnIds(mapping: ColumnMapping): string[] {
  return WRITABLE_FIELDS.map((field) => mapping[field]).filter(
    (id): id is string => id !== null,
  );
}

// --- Valeurs de colonne -----------------------------------------------------

/** Colonne `numbers` : Monday rend une chaîne, parfois vide. */
export function parseSponsoring(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * Colonne `file`. Deux formes selon la façon dont la valeur est lue : le JSON
 * de l'API GraphQL, ou la liste d'URL séparées par des virgules du champ texte.
 */
export function parseVisualUrls(raw: string | null | undefined): string[] {
  if (!raw) return [];

  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      const files = (parsed as { files?: { url?: string; name?: string }[] }).files;
      if (Array.isArray(files)) {
        return files
          .map((file) => file.url ?? file.name ?? "")
          .filter((url) => url.length > 0);
      }
    } catch {
      // Valeur illisible : on retombe sur la découpe par virgules.
    }
  }

  return trimmed
    .split(",")
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
}

/** Colonne `date` : `YYYY-MM-DD`, ou rien. */
export function parseScheduledOn(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw.trim());
  return match ? match[1]! : null;
}
