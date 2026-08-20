/**
 * Le registre de colonnes — ce qui fait du tableau un Monday et non une grille
 * figée.
 *
 * Les colonnes de base sont du **code** : leur type, leur largeur et leur
 * comportement d'édition sont connus du composant qui les rend. La base ne
 * stocke que les **écarts** — un libellé renommé, une colonne masquée, des
 * étiquettes recolorées — et les **colonnes ajoutées**, dont les valeurs vivent
 * dans `planning_subjects.custom`.
 *
 * Un tableau jamais retouché n'a donc aucune ligne dans `planning_columns`, et
 * l'écran reste complet : la fusion défauts + écarts se fait ici, à la lecture.
 */

import {
  AD_STATUS_COLORS,
  AD_STATUS_LABELS,
  AD_STATUS_ORDER,
  FORMAT_COLORS,
  FORMAT_LABELS,
  FORMAT_ORDER,
  STATUS_COLORS,
  STATUS_LABELS,
  STATUS_ORDER,
} from "./types";

export type ColumnType =
  | "status"
  | "dropdown"
  | "text"
  | "date"
  | "people"
  | "number"
  | "checkbox";

/** Une étiquette de statut ou de menu déroulant. */
export type ColumnLabel = {
  id: string;
  label: string;
  color: string;
};

export type ColumnSettings = {
  labels?: ColumnLabel[];
};

/** Ligne de `planning_columns`, écart ou colonne ajoutée. */
export type ColumnOverride = {
  id: string;
  board_id: string;
  builtin_key: string | null;
  type: ColumnType | null;
  label: string | null;
  position: number | null;
  hidden: boolean;
  settings: ColumnSettings;
  /** Largeur posée par la poignée de redimensionnement, en pixels. */
  width: number | null;
};

export type BuiltinKey =
  | "name"
  | "status"
  | "format"
  | "date"
  | "visual"
  | "wording"
  | "sponsoring"
  | "objective"
  | "ad_status"
  | "updated";

/** Une colonne prête à rendre, après fusion. */
export type ColumnDef = {
  /** Clé de base, ou l'uuid de la ligne pour une colonne ajoutée. */
  id: string;
  builtin: BuiltinKey | null;
  type: ColumnType | "visual" | "wording";
  label: string;
  /** Piste CSS de la grille (`minmax(...)` ou largeur fixe). */
  width: string;
  hidden: boolean;
  /** La colonne peut-elle être supprimée ? Seules les ajoutées le peuvent. */
  removable: boolean;
  /** Étiquettes effectives pour status/dropdown, après recoloration. */
  labels: ColumnLabel[] | null;
  position: number;
};

/**
 * Largeur par type — « des tailles cohérentes avec leur contenu ».
 *
 * Une piste CSS Grid par colonne. Seuls le sujet et le wording respirent avec
 * la fenêtre ; le reste est calibré sur sa valeur la plus large plausible.
 */
export const WIDTH_BY_TYPE: Record<ColumnType, string> = {
  status: "132px",
  dropdown: "128px",
  text: "minmax(140px,1fr)",
  date: "108px",
  people: "56px",
  number: "96px",
  checkbox: "48px",
};

const BUILTIN_WIDTHS: Record<BuiltinKey, string> = {
  // Le sujet est l'ancre de la ligne : c'est lui qu'on lit pour savoir de quoi
  // parle la publication. Il passait après le wording, qui n'est qu'un aperçu
  // tronqué de toute façon — « Coulisses de l'atelier luneti » coupé en
  // plein mot ne dit plus rien.
  name: "minmax(230px,2fr)",
  status: WIDTH_BY_TYPE.status,
  format: "120px",
  date: WIDTH_BY_TYPE.date,
  visual: "76px",
  wording: "minmax(170px,1.2fr)",
  sponsoring: WIDTH_BY_TYPE.number,
  objective: WIDTH_BY_TYPE.dropdown,
  ad_status: "108px",
  updated: "132px",
};

/** Pistes fixes hors registre : poignée + coche, les retours, le « + ». */
export const SELECT_TRACK = "52px";
export const COMMENTS_TRACK = "40px";
export const ADD_TRACK = "40px";

/**
 * Les objectifs publicitaires, en étiquettes colorées.
 *
 * La liste vient du tableau (`settings.ad_objectives`) ; les couleurs
 * reprennent la gamme bleu-violet du board d'origine, en cycle pour les
 * objectifs ajoutés au-delà des sept connus.
 */
const OBJECTIVE_COLORS: Record<string, string> = {
  Engagement: "#579bfc",
  "Vues vidéos": "#74afcc",
  Couverture: "#007eb5",
  Traffic: "#225091",
  Conversion: "#9d50dd",
  "Visite de profil": "#5559df",
  Followers: "#66ccff",
};

/** Exportée : « Mon travail » rend la même colonne Objectif que le board. */
export function objectiveLabels(adObjectives: string[]): ColumnLabel[] {
  return adObjectives.map((objective, index) => ({
    // La valeur stockée dans `ad_objective` est le libellé lui-même : c'est
    // l'existant, on ne migre pas les données pour une couleur.
    id: objective,
    label: objective,
    color:
      OBJECTIVE_COLORS[objective] ??
      LABEL_PALETTE[index % LABEL_PALETTE.length]!,
  }));
}

function statusLabels(): ColumnLabel[] {
  return STATUS_ORDER.filter((status) => status !== "idea").map((status) => ({
    id: status,
    label: STATUS_LABELS[status],
    color: STATUS_COLORS[status],
  }));
}

function formatLabels(): ColumnLabel[] {
  return FORMAT_ORDER.filter((format) => format !== "other").map((format) => ({
    id: format,
    label: FORMAT_LABELS[format],
    color: FORMAT_COLORS[format],
  }));
}

function adStatusLabels(): ColumnLabel[] {
  return AD_STATUS_ORDER.map((status) => ({
    id: status,
    label: AD_STATUS_LABELS[status],
    color: AD_STATUS_COLORS[status],
  }));
}

export type ResolveOptions = {
  /** Objectifs publicitaires du tableau — la matière des étiquettes Objectif. */
  adObjectives?: string[];
};

/** Les colonnes de base, dans l'ordre du tableau. */
export function builtinColumns(options: ResolveOptions = {}): ColumnDef[] {
  const defs: Omit<ColumnDef, "position">[] = [
    {
      id: "name",
      builtin: "name",
      type: "text",
      label: "Sujet",
      width: BUILTIN_WIDTHS.name,
      hidden: false,
      removable: false,
      labels: null,
    },
    {
      id: "status",
      builtin: "status",
      type: "status",
      label: "Statut",
      width: BUILTIN_WIDTHS.status,
      hidden: false,
      removable: false,
      labels: statusLabels(),
    },
    {
      id: "format",
      builtin: "format",
      type: "status",
      label: "Type",
      width: BUILTIN_WIDTHS.format,
      hidden: false,
      removable: false,
      labels: formatLabels(),
    },
    {
      id: "date",
      builtin: "date",
      type: "date",
      label: "Date",
      width: BUILTIN_WIDTHS.date,
      hidden: false,
      removable: false,
      labels: null,
    },
    {
      id: "visual",
      builtin: "visual",
      type: "visual",
      label: "Visuel",
      width: BUILTIN_WIDTHS.visual,
      hidden: false,
      removable: false,
      labels: null,
    },
    {
      id: "wording",
      builtin: "wording",
      type: "wording",
      label: "Wording",
      width: BUILTIN_WIDTHS.wording,
      hidden: false,
      removable: false,
      labels: null,
    },
    {
      id: "sponsoring",
      builtin: "sponsoring",
      type: "number",
      label: "Sponso",
      width: BUILTIN_WIDTHS.sponsoring,
      hidden: false,
      removable: false,
      labels: null,
    },
    {
      id: "objective",
      builtin: "objective",
      type: "dropdown",
      label: "Objectif Ads",
      width: BUILTIN_WIDTHS.objective,
      hidden: false,
      removable: false,
      labels: objectiveLabels(options.adObjectives ?? Object.keys(OBJECTIVE_COLORS)),
    },
    {
      id: "ad_status",
      builtin: "ad_status",
      type: "status",
      label: "Statut Ads",
      width: BUILTIN_WIDTHS.ad_status,
      hidden: false,
      removable: false,
      labels: adStatusLabels(),
    },
    {
      id: "updated",
      builtin: "updated",
      type: "text",
      label: "Last update",
      width: BUILTIN_WIDTHS.updated,
      hidden: false,
      removable: false,
      labels: null,
    },
  ];

  return defs.map((def, index) => ({ ...def, position: index * 10 }));
}

/**
 * Fusionne défauts et écarts.
 *
 * Un écart ne porte que ce qu'il change : libellé, position, visibilité,
 * étiquettes. Une colonne ajoutée devient une définition entière, sa valeur
 * étant lue dans `subject.custom[id]`.
 */
export function resolveColumns(
  overrides: ColumnOverride[],
  options: ResolveOptions = {},
): ColumnDef[] {
  const byBuiltin = new Map(
    overrides
      .filter((override) => override.builtin_key !== null)
      .map((override) => [override.builtin_key!, override]),
  );

  const merged = builtinColumns(options).map((def) => {
    const override = byBuiltin.get(def.id);
    if (!override) return def;
    return {
      ...def,
      label: override.label ?? def.label,
      hidden: override.hidden,
      position: override.position ?? def.position,
      width: override.width ? `${override.width}px` : def.width,
      labels: mergeLabels(def.labels, override.settings.labels),
    };
  });

  const added = overrides
    .filter((override) => override.builtin_key === null && override.type !== null)
    .map(
      (override, index): ColumnDef => ({
        id: override.id,
        builtin: null,
        type: override.type!,
        label: override.label ?? "Colonne",
        width: override.width
          ? `${override.width}px`
          : WIDTH_BY_TYPE[override.type!],
        hidden: override.hidden,
        removable: true,
        labels:
          override.type === "status" || override.type === "dropdown"
            ? (override.settings.labels ?? [])
            : null,
        position: override.position ?? 1000 + index,
      }),
    );

  return [...merged, ...added]
    .filter((def) => !def.hidden)
    .sort((a, b) => a.position - b.position);
}

/**
 * Fusion des étiquettes d'une colonne de base.
 *
 * L'écart peut renommer, recolorer **et ajouter** — « + Nouvelle étiquette »
 * marche partout, comme sur le board d'origine. Les étiquettes connues gardent
 * leur identifiant, celles ajoutées apportent le leur ; depuis la migration
 * 0029 la colonne est du texte, une valeur inventée a où s'écrire.
 */
function mergeLabels(
  base: ColumnLabel[] | null,
  overrides: ColumnLabel[] | undefined,
): ColumnLabel[] | null {
  if (base === null) return null;
  if (!overrides || overrides.length === 0) return base;

  const byId = new Map(overrides.map((label) => [label.id, label]));
  const knownIds = new Set(base.map((label) => label.id));

  const merged = base.map((label) => {
    const override = byId.get(label.id);
    return override
      ? { ...label, label: override.label || label.label, color: override.color || label.color }
      : label;
  });

  const additions = overrides.filter((label) => !knownIds.has(label.id));
  return [...merged, ...additions];
}

/**
 * Largeurs de séance, pendant un drag de redimensionnement : appliquées
 * par-dessus les définitions sans attendre l'aller-retour serveur.
 */
export function applyWidths(
  columns: ColumnDef[],
  widths: Record<string, number>,
): ColumnDef[] {
  return columns.map((column) =>
    widths[column.id] ? { ...column, width: `${widths[column.id]}px` } : column,
  );
}

/** La chaîne `grid-template-columns` du tableau, coche et « + » comprises. */
export function gridTemplate(columns: ColumnDef[]): string {
  return [
    SELECT_TRACK,
    ...columns.map((column) =>
      column.builtin === "name"
        ? `${column.width} ${COMMENTS_TRACK}`
        : column.width,
    ),
    ADD_TRACK,
  ].join(" ");
}

/** Les types proposés au menu « ajouter une colonne », groupés comme Monday. */
export const ADDABLE_TYPES: {
  group: string;
  entries: { type: ColumnType; label: string }[];
}[] = [
  {
    group: "Indispensables",
    entries: [
      { type: "status", label: "Statut" },
      { type: "dropdown", label: "Menu déroulant" },
      { type: "text", label: "Texte" },
      { type: "date", label: "Date" },
      { type: "people", label: "Personnes" },
      { type: "number", label: "Chiffres" },
    ],
  },
  {
    group: "Super pratique",
    entries: [{ type: "checkbox", label: "Case à cocher" }],
  },
];

/** Étiquettes de départ d'une colonne statut ajoutée — celles de Monday. */
export function defaultLabelsFor(type: ColumnType): ColumnLabel[] | null {
  if (type === "status") {
    return [
      { id: "todo", label: "À FAIRE", color: "#df2f4a" },
      { id: "doing", label: "EN COURS", color: "#fdab3d" },
      { id: "done", label: "FAIT", color: "#00c875" },
    ];
  }
  if (type === "dropdown") {
    return [
      { id: "option-1", label: "Option 1", color: "#579bfc" },
      { id: "option-2", label: "Option 2", color: "#9d50dd" },
    ];
  }
  return null;
}

/** La palette d'étiquettes de Monday, proposée à la création d'une étiquette. */
export const LABEL_PALETTE = [
  "#00c875",
  "#9cd326",
  "#fdab3d",
  "#ff6d3b",
  "#df2f4a",
  "#9d50dd",
  "#784bd1",
  "#401694",
  "#66ccff",
  "#579bfc",
  "#225091",
  "#007eb5",
  "#9aadbd",
  "#5559df",
];
