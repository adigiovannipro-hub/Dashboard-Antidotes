/**
 * Modèle du Planning Éditorial.
 *
 * Aligné sur `supabase/migrations/0006_planning_schema.sql`. Alias de type et
 * non `interface` : TypeScript ne donne d'index signature implicite qu'aux
 * premiers, et postgrest-js en a besoin pour inférer les résultats de requête.
 *
 * Les libellés et les couleurs reprennent exactement ceux du board Monday
 * d'origine. Ce n'est pas de la coquetterie : l'équipe lit ce tableau depuis
 * des mois, et un orange qui ne veut plus dire « en cours » coûte plus cher
 * qu'une palette cohérente.
 */

export type PlanningBoardKind = "editorial" | "faq";

export type PlanningPlatform =
  | "meta"
  | "instagram"
  | "facebook"
  | "linkedin"
  | "tiktok"
  | "youtube"
  | "x"
  | "pinterest"
  | "snapchat"
  | "other";

export const PLATFORM_LABELS: Record<PlanningPlatform, string> = {
  meta: "META",
  instagram: "INSTAGRAM",
  facebook: "FACEBOOK",
  linkedin: "LINKEDIN",
  tiktok: "TIKTOK",
  youtube: "YOUTUBE",
  x: "X",
  pinterest: "PINTEREST",
  snapchat: "SNAPCHAT",
  other: "AUTRE",
};

/** Ordre du sélecteur « ajouter un réseau ». */
export const PLATFORM_ORDER: PlanningPlatform[] = [
  "meta",
  "instagram",
  "facebook",
  "linkedin",
  "tiktok",
  "youtube",
  "x",
  "pinterest",
  "snapchat",
  "other",
];

export type PlanningFormat =
  | "post"
  | "story"
  | "reel"
  | "carousel"
  | "video"
  | "thread"
  | "dark"
  | "other";

export const FORMAT_LABELS: Record<PlanningFormat, string> = {
  post: "POST",
  story: "STORIE",
  reel: "REELS",
  carousel: "CARROUSEL",
  video: "VIDEO",
  thread: "THREAD",
  dark: "DARK",
  other: "—",
};

/**
 * Les mêmes formats, en prose.
 *
 * Les pastilles du tableau sont en capitales, comme dans le board. Une phrase
 * ne peut pas l'être : « deux REELSs à la suite » ne se lit pas.
 */
export const FORMAT_PROSE: Record<PlanningFormat, string> = {
  post: "Post",
  story: "Story",
  reel: "Reel",
  carousel: "Carrousel",
  video: "Vidéo",
  thread: "Thread",
  dark: "Dark",
  other: "contenu",
};

export const FORMAT_PROSE_PLURAL: Record<PlanningFormat, string> = {
  post: "Posts",
  story: "Stories",
  reel: "Reels",
  carousel: "Carrousels",
  video: "Vidéos",
  thread: "Threads",
  dark: "Darks",
  other: "contenus",
};

export const FORMAT_COLORS: Record<PlanningFormat, string> = {
  post: "#784bd1",
  story: "#401694",
  reel: "#9d50dd",
  carousel: "#66ccff",
  video: "#579bfc",
  thread: "#225091",
  dark: "#5559df",
  other: "#c4c4c4",
};

export const FORMAT_ORDER: PlanningFormat[] = [
  "post",
  "story",
  "reel",
  "carousel",
  "video",
  "thread",
  "dark",
  "other",
];

export type PlanningStatus =
  | "idea"
  | "dropped"
  | "on_hold"
  | "in_progress"
  | "wording_todo"
  | "to_validate"
  | "validated"
  | "draft"
  | "scheduled"
  | "published";

export const STATUS_LABELS: Record<PlanningStatus, string> = {
  idea: "—",
  dropped: "NON RETENU",
  on_hold: "EN ATTENTE",
  in_progress: "EN COURS",
  wording_todo: "WORDING À FAIRE",
  to_validate: "À VALIDER",
  validated: "VALIDÉ",
  draft: "EN BROUILLON",
  scheduled: "PROGRAMMÉ",
  published: "PUBLIÉ",
};

export const STATUS_COLORS: Record<PlanningStatus, string> = {
  idea: "#c4c4c4",
  dropped: "#9aadbd",
  on_hold: "#9d50dd",
  in_progress: "#fdab3d",
  wording_todo: "#ff6d3b",
  to_validate: "#df2f4a",
  validated: "#007eb5",
  draft: "#9cd326",
  scheduled: "#66ccff",
  published: "#00c875",
};

/** Ordre du sélecteur de statut, celui du board. */
export const STATUS_ORDER: PlanningStatus[] = [
  "dropped",
  "draft",
  "on_hold",
  "scheduled",
  "in_progress",
  "published",
  "wording_todo",
  "to_validate",
  "validated",
  "idea",
];

export type PlanningAdStatus = "todo" | "doing" | "done" | "blocked";

export const AD_STATUS_LABELS: Record<PlanningAdStatus, string> = {
  todo: "À faire",
  doing: "En cours",
  done: "Fait",
  blocked: "Bloqué",
};

export const AD_STATUS_COLORS: Record<PlanningAdStatus, string> = {
  todo: "#df2f4a",
  doing: "#fdab3d",
  done: "#00c875",
  blocked: "#7e3b8a",
};

export const AD_STATUS_ORDER: PlanningAdStatus[] = [
  "todo",
  "doing",
  "done",
  "blocked",
];

/** Objectifs proposés par défaut ; chaque tableau porte les siens. */
export const DEFAULT_AD_OBJECTIVES = [
  "Engagement",
  "Vues vidéos",
  "Couverture",
  "Traffic",
  "Conversion",
  "Visite de profil",
  "Followers",
];

export type PlanningCommentScope = "general" | "visual" | "wording";

export const COMMENT_SCOPE_LABELS: Record<PlanningCommentScope, string> = {
  general: "Général",
  visual: "Visuel",
  wording: "Wording",
};

/**
 * Statuts qui sortent une publication du planning.
 *
 * `dropped` ne compte ni dans le volume du mois, ni dans l'alternance des
 * formats : un contenu non retenu n'a jamais existé pour le lecteur.
 */
export const EXCLUDED_STATUSES: PlanningStatus[] = ["dropped"];

export const DONE_STATUSES: PlanningStatus[] = ["published"];

export const READY_STATUSES: PlanningStatus[] = ["validated", "scheduled"];

export function isPlanned(status: string): boolean {
  return !(EXCLUDED_STATUSES as string[]).includes(status);
}

/**
 * Formats qui ne doivent pas se suivre.
 *
 * Jamais deux sets de Stories consécutifs, jamais deux Reels consécutifs si
 * possible. Les Posts, eux, peuvent s'enchaîner — c'est le format de fond.
 */
export const NO_REPEAT_FORMATS: PlanningFormat[] = ["reel", "story"];

// --- Lignes de la base -----------------------------------------------------

export type BoardSettings = {
  ad_objectives: string[];
};

export type PlanningBoard = {
  id: string;
  workspace_id: string;
  kind: PlanningBoardKind;
  slug: string;
  name: string;
  year: number | null;
  position: number;
  settings: BoardSettings;
  created_at: string;
};

export type PlanningMonth = {
  id: string;
  board_id: string;
  workspace_id: string;
  label: string;
  /** Premier jour du mois, `YYYY-MM-01`. */
  month: string;
  position: number;
  /** Corbeille : `null` quand le mois est visible au tableau. */
  deleted_at: string | null;
  created_at: string;
};

export type PlanningLane = {
  id: string;
  month_id: string;
  board_id: string;
  workspace_id: string;
  platform: PlanningPlatform;
  name: string;
  position: number;
  created_at: string;
};

/** Le propriétaire d'une publication, tel qu'affiché dans la colonne. */
export type PlanningOwner = {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
};

export type PlanningSubject = {
  id: string;
  lane_id: string;
  month_id: string;
  board_id: string;
  workspace_id: string;
  name: string;
  /** Identifiant d'étiquette. Les valeurs connues sont `PlanningStatus` ; une
      étiquette ajoutée (« + Nouvelle étiquette ») porte le sien. */
  status: string;
  format: string;
  scheduled_on: string | null;
  wording: string | null;
  sponsoring: number | null;
  ad_objective: string | null;
  ad_status: string | null;
  owner_id: string | null;
  /** Chemins dans le bucket `planning-visuals`, ou URL externes. */
  visual_urls: string[];
  /** Valeurs des colonnes ajoutées, indexées par identifiant de colonne. */
  custom: Record<string, string | number | boolean | null>;
  position: number;
  /** Archives et corbeille : `null` quand la ligne est visible au tableau. */
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

/** Une entrée du journal d'activité d'une publication. */
export type PlanningActivity = {
  id: number;
  subject_id: string;
  workspace_id: string;
  actor_id: string | null;
  /** `created`, ou le nom du champ modifié. */
  field: string;
  before: string | null;
  after: string | null;
  created_at: string;
  actor: PlanningOwner | null;
  /** « il y a 2 h », « 12 juil. » — calculé côté serveur, l'affichage reste pur. */
  created_label: string;
};

/** Un visuel prêt à l'affichage : le chemin stocké et son URL signée. */
export type ResolvedVisual = {
  path: string;
  url: string;
  name: string;
};

/** Une publication telle que la lit l'interface. */
export type SubjectRow = PlanningSubject & {
  platform: PlanningPlatform;
  lane_name: string;
  month_key: string;
  owner: PlanningOwner | null;
  comments: PlanningComment[];
  visuals: ResolvedVisual[];
  /** Auteur de la dernière modification, résolu depuis `updated_by`. */
  updater: PlanningOwner | null;
  /** « 12 juil. 14:02 » — calculé côté serveur, l'affichage reste pur. */
  updated_label: string;
};

export type PlanningComment = {
  id: string;
  subject_id: string;
  workspace_id: string;
  author_id: string | null;
  scope: PlanningCommentScope;
  body: string;
  /** Adresses prévenues par e-mail à l'écriture du retour. */
  mentions: string[];
  created_at: string;
  author: PlanningOwner | null;
};

export type FaqEntry = {
  id: string;
  board_id: string;
  workspace_id: string;
  question: string;
  answer: string | null;
  category: string | null;
  position: number;
  source: string;
  created_at: string;
  updated_at: string;
};

// --- Vues assemblées --------------------------------------------------------

export type LaneWithSubjects = PlanningLane & {
  subjects: SubjectRow[];
};

export type MonthWithLanes = PlanningMonth & {
  lanes: LaneWithSubjects[];
};

// --- Formes minimales pour les analyses ------------------------------------

/**
 * Ce dont la cadence et la stratégie ont besoin, et rien de plus.
 *
 * Les analyses tournent aussi bien sur une ligne complète venue de la base que
 * sur un objet de test à huit champs — d'où la forme structurelle plutôt qu'un
 * type de ligne concret.
 */
export type AnalysableSubject = {
  id: string;
  name: string;
  platform: PlanningPlatform;
  format: PlanningFormat;
  status: PlanningStatus;
  scheduled_on: string | null;
  sponsoring: number | null;
  /** Premier jour du mois du groupe, `YYYY-MM-01`. */
  month_key: string;
};

/** Ce dont la santé de production a besoin en plus. */
export type ProducibleSubject = AnalysableSubject & {
  wording: string | null;
  visual_urls: string[];
};

/**
 * Stratégie déclarée à la main.
 *
 * Rarement renseignée — le cas courant est de la déduire de l'historique, ce
 * que fait `strategy.ts`. Elle existe pour le client qui a formalisé sa ligne
 * éditoriale et dont le rythme réel ne la reflète pas encore.
 */
export type StrategyOverride = {
  platforms: Partial<
    Record<
      PlanningPlatform,
      {
        monthly_target: number;
        format_mix: Partial<Record<PlanningFormat, number>>;
      }
    >
  >;
};

export function hasWording(subject: { wording: string | null }): boolean {
  return (subject.wording ?? "").trim().length > 0;
}

/** Somme de sponsorisation d'un ensemble de publications. */
export function totalSponsoring(subjects: { sponsoring: number | null }[]): number {
  return subjects.reduce((sum, subject) => sum + (subject.sponsoring ?? 0), 0);
}
