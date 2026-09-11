/**
 * Préférences d'affichage mémorisées dans un cookie.
 *
 * Ni `"use client"`, ni `import "server-only"` : ce module est lu des deux
 * côtés, et c'est tout son intérêt. Une constante exportée depuis un fichier
 * `"use client"` devient une **référence opaque** quand un composant serveur
 * l'importe — elle ne vaut plus la chaîne qu'elle contient, et le cookie
 * n'est jamais retrouvé. Le défaut est silencieux : rien ne casse, le réglage
 * ne se souvient simplement de rien.
 *
 * Un cookie plutôt que le stockage local : c'est le serveur qui doit connaître
 * la préférence, puisque c'est lui qui rend la première image.
 */

/** Rail de navigation replié. `"1"` replié, tout le reste déplié. */
export const RAIL_COOKIE = "antidotes_rail";

/**
 * Montants de trésorerie masqués sur l'écran Finance. `"1"` masqué.
 *
 * Le défaut est « visible » : c'est un écran privé, et un chiffre caché par
 * défaut obligerait à un clic à chaque ouverture. Le masque sert au moment où
 * quelqu'un regarde par-dessus l'épaule, pas en permanence.
 */
export const CASH_HIDDEN_COOKIE = "antidotes_cash_hidden";

/** Un an, limité à ce site : une préférence d'affichage ne voyage pas. */
export const PREFERENCE_MAX_AGE = 31_536_000;

// --- Pipeline Antidotes : kanban ou tableau ---------------------------------

/**
 * La vue du pipeline. `"tableau"` pour la vue en lignes, tout le reste vaut
 * le kanban — la vue par défaut, celle où l'on déplace les prospects.
 */
export const PIPELINE_VIEW_COOKIE = "antidotes_pipeline_vue";

export type PipelineView = "kanban" | "tableau";

export function parsePipelineView(raw: string | undefined): PipelineView {
  return raw === "tableau" ? "tableau" : "kanban";
}

// --- Planning Éditorial : l'état de lecture d'un tableau ---------------------

/**
 * Un cookie par tableau : le tri de la colonne Date, les mois ouverts, les
 * réseaux repliés. On revient sur le planning tel qu'on l'a laissé.
 *
 * Un cookie par tableau plutôt qu'un seul pour tous : chacun reste petit, et
 * l'oubli d'un tableau ne touche pas les autres.
 */
export function planningViewCookie(workspace: string, board: string): string {
  return `antidotes_planning_${workspace}_${board}`.replace(/[^\w]/g, "_");
}

/** Les colonnes qui savent se trier depuis leur en-tête. La date se range en
    chronologie ; une colonne à étiquettes suit l'ordre de ses étiquettes —
    POST avant REELS avant CARROUSEL, si c'est leur ordre déclaré. */
export const SORTABLE_COLUMN_KEYS = [
  "date",
  "status",
  "format",
  "objective",
  "ad_status",
] as const;

export type SortableColumnKey = (typeof SORTABLE_COLUMN_KEYS)[number];

export type PlanningSort =
  | "position"
  | { column: SortableColumnKey; direction: "asc" | "desc" };

export type PlanningView = {
  /** `position` : l'ordre manuel du tableau. */
  sort: PlanningSort;
  /** Tableau par défaut ; le calendrier montre un mois en grille de jours. */
  mode: "tableau" | "calendrier";
  /**
   * Mois ouverts, par clé `YYYY-MM`.
   *
   * `null` — jamais touché — vaut « le mois en cours, comme au premier jour » ;
   * une liste **vide** vaut « tout replié », et c'est un choix. Confondre les
   * deux rouvrirait le mois courant à chaque retour sur la page.
   */
  months: string[] | null;
  /**
   * Réseaux **repliés**, par identifiant. Un couloir est ouvert par défaut :
   * mémoriser l'exception plutôt que la règle garde le cookie court.
   */
  closedLanes: string[];
};

export const DEFAULT_PLANNING_VIEW: PlanningView = {
  sort: "position",
  mode: "tableau",
  months: null,
  closedLanes: [],
};

/**
 * Relit le cookie sans jamais jeter : un cookie tronqué, écrit par une version
 * précédente ou bricolé à la main, doit rendre le tableau par défaut — pas une
 * page en erreur.
 */
export function parsePlanningView(raw: string | undefined): PlanningView {
  if (!raw) return DEFAULT_PLANNING_VIEW;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_PLANNING_VIEW;

    const value = parsed as Partial<Record<keyof PlanningView, unknown>>;
    const strings = (input: unknown): string[] =>
      Array.isArray(input)
        ? input.filter((entry): entry is string => typeof entry === "string").slice(0, 200)
        : [];

    return {
      sort: parseSort(value.sort),
      mode: value.mode === "calendrier" ? "calendrier" : "tableau",
      months: Array.isArray(value.months) ? strings(value.months) : null,
      closedLanes: strings(value.closedLanes),
    };
  } catch {
    return DEFAULT_PLANNING_VIEW;
  }
}

function parseSort(raw: unknown): PlanningSort {
  if (raw === "position") return "position";
  // Les cookies d'avant la généralisation ne connaissaient que la Date.
  if (raw === "asc" || raw === "desc") return { column: "date", direction: raw };
  if (typeof raw === "object" && raw !== null) {
    const candidate = raw as { column?: unknown; direction?: unknown };
    if (
      SORTABLE_COLUMN_KEYS.includes(candidate.column as SortableColumnKey) &&
      (candidate.direction === "asc" || candidate.direction === "desc")
    ) {
      return {
        column: candidate.column as SortableColumnKey,
        direction: candidate.direction,
      };
    }
  }
  return "position";
}

export function serializePlanningView(view: PlanningView): string {
  return encodeURIComponent(JSON.stringify(view));
}

// --- FAQ : la largeur des colonnes ------------------------------------------

/**
 * Un cookie par client de modération : la largeur des colonnes qu'on a
 * élargies à la main.
 *
 * Seules les colonnes retouchées y figurent — une colonne jamais touchée
 * garde sa piste par défaut et suit donc la largeur de l'écran. Mémoriser
 * toutes les largeurs figerait le tableau au format de la première machine
 * qui l'a ouvert.
 */
export function faqViewCookie(clientId: string): string {
  return `antidotes_faq_${clientId}`.replace(/[^\w]/g, "_");
}

/** Bornes de sécurité : un cookie bricolé ne doit pas rendre une colonne
    invisible ni pousser le tableau à dix mille pixels. */
export const FAQ_COLUMN_MIN = 80;
export const FAQ_COLUMN_MAX = 900;

export type FaqColumnWidths = Record<string, number>;

/**
 * Borne une largeur de colonne, avec un plancher **par colonne**.
 *
 * Tant qu'une colonne est en `minmax(180px, 1.3fr)`, c'est la piste qui tient
 * le plancher ; élargir à la souris la fige en pixels et le plancher disparaît
 * avec elle — la Question pouvait alors tomber à 80 px, sous la largeur d'un
 * mot. Le plancher voyage donc avec le geste, et cette fonction est le seul
 * endroit où une largeur se borne : le cookie et la poignée ne peuvent plus
 * diverger.
 */
export function clampFaqColumnWidth(width: number, min: number = FAQ_COLUMN_MIN): number {
  const floor = Math.max(FAQ_COLUMN_MIN, min);
  return Math.min(FAQ_COLUMN_MAX, Math.max(floor, Math.round(width)));
}

export function parseFaqColumnWidths(raw: string | undefined): FaqColumnWidths {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    if (typeof parsed !== "object" || parsed === null) return {};
    const widths: FaqColumnWidths = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      widths[key] = clampFaqColumnWidth(value);
    }
    return widths;
  } catch {
    return {};
  }
}

export function serializeFaqColumnWidths(widths: FaqColumnWidths): string {
  return encodeURIComponent(JSON.stringify(widths));
}
