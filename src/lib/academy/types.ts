/**
 * Types du module Academy — alignés sur les migrations 0056 et 0057.
 *
 * `type` et non `interface` : postgrest-js a besoin de l'index signature
 * implicite que TypeScript ne donne qu'aux alias de type pour inférer les
 * résultats de requête.
 */

export type AcademyVideoProvider = "supabase" | "youtube" | "vimeo" | "mux" | "none";

export const VIDEO_PROVIDER_LABELS: Record<AcademyVideoProvider, string> = {
  supabase: "Hébergée ici",
  youtube: "YouTube",
  vimeo: "Vimeo",
  mux: "Mux",
  none: "Vidéo à venir",
};

export type AcademyProgressStatus = "not_started" | "in_progress" | "completed";

export const PROGRESS_STATUS_LABELS: Record<AcademyProgressStatus, string> = {
  not_started: "Pas commencée",
  in_progress: "En cours",
  completed: "Terminée",
};

/** Nature d'une ressource de leçon — la forme du jsonb `resources`. */
export type AcademyResourceKind = "template" | "checklist" | "link" | "tool";

export const RESOURCE_KIND_LABELS: Record<AcademyResourceKind, string> = {
  template: "Modèle",
  checklist: "Checklist",
  link: "Lien",
  tool: "Outil",
};

export type AcademyResource = {
  title: string;
  description: string | null;
  kind: AcademyResourceKind;
  /** Nulle pour un support à créer soi-même (modèle, checklist). */
  url: string | null;
};

/** Une vidéo compte comme vue à 90 % de sa durée — le générique ne retient
    personne, exiger 100 % laisserait toutes les leçons « en cours ». */
export const COMPLETION_RATIO = 0.9;

// --- Lignes de base ----------------------------------------------------------

export type AcademyCourse = {
  id: string;
  org_id: string;
  slug: string;
  title: string;
  description: string | null;
  /** Chemin dans le bucket `academy-assets`, ou URL http(s) externe. */
  cover_url: string | null;
  order_index: number;
  published: boolean;
  created_at: string;
  updated_at: string;
};

export type AcademyModule = {
  id: string;
  course_id: string;
  org_id: string;
  slug: string;
  title: string;
  description: string | null;
  order_index: number;
  published: boolean;
  created_at: string;
  updated_at: string;
};

export type AcademyLesson = {
  id: string;
  module_id: string;
  course_id: string;
  org_id: string;
  slug: string;
  title: string;
  summary: string | null;
  script_mdx: string;
  duration_min: number | null;
  video_provider: AcademyVideoProvider;
  video_url: string | null;
  video_storage_path: string | null;
  thumbnail_url: string | null;
  resources: AcademyResource[];
  order_index: number;
  published: boolean;
  created_at: string;
  updated_at: string;
};

export type AcademyProgress = {
  id: string;
  org_id: string;
  user_id: string;
  lesson_id: string;
  status: AcademyProgressStatus;
  watched_seconds: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AcademyNote = {
  id: string;
  org_id: string;
  user_id: string;
  lesson_id: string;
  content: string;
  created_at: string;
  updated_at: string;
};
