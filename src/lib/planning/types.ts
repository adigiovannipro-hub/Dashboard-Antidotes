/**
 * Modèle du module Planning Édito.
 *
 * Aligné sur `supabase/migrations/0006_planning_schema.sql`. Alias de type et
 * non `interface`, pour la même raison que dans la Modération : postgrest-js a
 * besoin de l'index signature implicite pour inférer les résultats de requête.
 */

export type PlanningPlatform =
  | "meta"
  | "instagram"
  | "facebook"
  | "linkedin"
  | "tiktok"
  | "youtube"
  | "x"
  /** Pas un réseau : le couloir des campagnes non publiées sur le feed. */
  | "dark"
  | "other";

export const PLATFORM_LABELS: Record<PlanningPlatform, string> = {
  meta: "Meta",
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X",
  dark: "Dark",
  other: "Autre",
};

/** Ordre d'affichage des couloirs, indépendant de l'ordre Monday. */
export const PLATFORM_ORDER: PlanningPlatform[] = [
  "meta",
  "instagram",
  "facebook",
  "linkedin",
  "tiktok",
  "youtube",
  "x",
  "dark",
  "other",
];

export type PlanningFormat =
  | "reel"
  | "post"
  | "story"
  | "carousel"
  | "thread"
  | "video"
  | "dark"
  | "other";

export const FORMAT_LABELS: Record<PlanningFormat, string> = {
  reel: "Reel",
  post: "Post",
  story: "Story",
  carousel: "Carrousel",
  thread: "Thread",
  video: "Vidéo",
  dark: "Dark",
  other: "Autre",
};

/**
 * Formats qui ne doivent pas se suivre.
 *
 * Règle des skills éditoriales : jamais deux sets de Stories consécutifs,
 * jamais deux Reels consécutifs si possible. Les Posts, eux, peuvent
 * s'enchaîner — c'est le format de fond.
 */
export const NO_REPEAT_FORMATS: PlanningFormat[] = ["reel", "story"];

export type PlanningStatus =
  | "idea"
  | "wording_todo"
  | "draft"
  | "in_progress"
  | "to_validate"
  | "validated"
  | "scheduled"
  | "published"
  | "on_hold"
  | "dropped";

export const STATUS_LABELS: Record<PlanningStatus, string> = {
  idea: "Idée",
  wording_todo: "Wording à faire",
  draft: "En brouillon",
  in_progress: "En cours",
  to_validate: "À valider",
  validated: "Validé",
  scheduled: "Programmé",
  published: "Publié",
  on_hold: "En attente",
  dropped: "Non retenu",
};

/**
 * Statuts qui sortent un sujet du planning.
 *
 * `dropped` ne compte ni dans le volume du mois, ni dans la déduction de
 * stratégie, ni dans l'alternance des formats : un contenu non retenu n'a
 * jamais existé pour le lecteur.
 */
export const EXCLUDED_STATUSES: PlanningStatus[] = ["dropped"];

/** Le contenu est parti : plus rien à produire dessus. */
export const DONE_STATUSES: PlanningStatus[] = ["published"];

/** Le contenu est prêt à partir, en attente de sa date. */
export const READY_STATUSES: PlanningStatus[] = ["validated", "scheduled"];

export function isPlanned(status: PlanningStatus): boolean {
  return !EXCLUDED_STATUSES.includes(status);
}

export type PlanningRole = "owner" | "editor" | "viewer";

// --- Lignes de la base -----------------------------------------------------

/**
 * Stratégie déclarée d'un client.
 *
 * `null` en base — le cas courant — signifie « déduire de l'historique ». Voir
 * `strategy.ts` : c'est ce qu'attend le skill `editorial-planner` quand aucun
 * document de stratégie n'existe.
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

export type PlanningClient = {
  id: string;
  org_id: string;
  workspace_id: string | null;
  slug: string;
  name: string;
  strategy_override: StrategyOverride | null;
  archived_at: string | null;
  created_at: string;
};

/**
 * Mapping d'un board : champ canonique → id de colonne Monday.
 *
 * Les identifiants ne sont pas les mêmes d'un client à l'autre, et certaines
 * colonnes manquent purement et simplement chez certains. D'où le `null`
 * explicite plutôt qu'une clé absente : « ce board n'a pas de Commentaires » est
 * une information, pas un oubli de configuration.
 */
export type ColumnMapping = {
  status: string | null;
  format: string | null;
  date: string | null;
  wording: string | null;
  comments: string | null;
  sponsoring: string | null;
  objective: string | null;
  owner: string | null;
  visual: string | null;
};

export type PlanningBoard = {
  id: string;
  client_id: string;
  monday_board_id: string;
  monday_subitem_board_id: string | null;
  name: string;
  year: number | null;
  url: string | null;
  is_archive: boolean;
  column_mapping: ColumnMapping;
  status_mapping: Record<string, PlanningStatus>;
  last_synced_at: string | null;
  created_at: string;
};

export type PlanningMonth = {
  id: string;
  board_id: string;
  client_id: string;
  monday_group_id: string;
  label: string;
  /** Premier jour du mois, `YYYY-MM-01`. */
  month: string;
  position: number;
  created_at: string;
};

export type PlanningLane = {
  id: string;
  month_id: string;
  client_id: string;
  monday_item_id: string;
  platform: PlanningPlatform;
  name: string;
  position: number;
  created_at: string;
};

export type PlanningSubject = {
  id: string;
  lane_id: string;
  month_id: string;
  client_id: string;
  monday_item_id: string;
  name: string;
  format: PlanningFormat;
  format_raw: string | null;
  scheduled_on: string | null;
  status: PlanningStatus;
  status_raw: string | null;
  wording: string | null;
  comments: string | null;
  sponsoring: number | null;
  objective: string | null;
  owner_name: string | null;
  visual_urls: string[];
  permalink: string | null;
  pending_wording: string | null;
  pending_since: string | null;
  pushed_at: string | null;
  monday_updated_at: string | null;
  synced_at: string;
  created_at: string;
};

/**
 * Un sujet replacé dans son couloir et son mois — ce que lit l'interface.
 *
 * `month_key` est le premier jour du mois du *groupe* Monday, qui n'est pas
 * toujours celui de `scheduled_on` : un contenu planifié en fin de mois et
 * décalé au 2 du suivant reste dans le groupe où il a été pensé. Les deux
 * informations sont utiles, aucune ne remplace l'autre.
 */
export type SubjectWithLane = PlanningSubject & {
  platform: PlanningPlatform;
  lane_name: string;
  month_key: string;
};

/** Un mois du sélecteur : son board d'origine et son remplissage. */
export type MonthSummary = PlanningMonth & {
  board_name: string;
  subject_count: number;
};

export type PlanningSyncRun = {
  id: string;
  client_id: string;
  board_id: string | null;
  direction: "pull" | "push";
  status: "running" | "success" | "error";
  started_at: string;
  finished_at: string | null;
  boards_seen: number;
  subjects_upserted: number;
  error: string | null;
};

/**
 * Le wording effectif d'un sujet : la modification en attente de push si elle
 * existe, sinon ce que Monday connaît.
 */
export function effectiveWording(subject: PlanningSubject): string | null {
  return subject.pending_wording ?? subject.wording;
}

export function hasWording(subject: PlanningSubject): boolean {
  return (effectiveWording(subject) ?? "").trim().length > 0;
}
