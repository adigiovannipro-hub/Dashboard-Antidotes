/**
 * Modèle du module « Production » — le cycle mensuel des cartes client.
 *
 * Aligné sur `supabase/migrations/0032_production_schema.sql`. Alias de type
 * et non `interface` : TypeScript ne donne d'index signature implicite qu'aux
 * premiers, et postgrest-js en a besoin pour inférer les résultats de requête.
 */

import type { PlanningPlatform } from "@/lib/planning/types";

/** Les quatre phases du cycle, dans l'ordre strict du mois. */
export type ProductionPhase =
  | "intentions"
  | "wording"
  | "programmation"
  | "reporting";

export const PHASE_LABELS: Record<ProductionPhase, string> = {
  intentions: "Intentions",
  wording: "Content",
  // La clé reste `programmation` — enum en base, segment d'URL — mais le
  // moment du cycle est celui du client : son planning part en validation,
  // la publication elle-même étant automatique à 16h.
  programmation: "Validation",
  reporting: "Reporting",
};

/** L'ordre de progression de la chaîne du mois cible. */
export const PHASE_ORDER: ProductionPhase[] = [
  "intentions",
  "wording",
  "programmation",
  "reporting",
];

/**
 * L'ordre d'affichage — barre de segments et menus. Le Reporting ouvre la
 * barre : il analyse le mois écoulé et se fait **avant** les intentions du
 * suivant, c'est la chronologie réelle du mois de travail.
 */
export const PHASE_DISPLAY_ORDER: ProductionPhase[] = [
  "reporting",
  "intentions",
  "wording",
  "programmation",
];

export function isProductionPhase(value: string): value is ProductionPhase {
  return (PHASE_ORDER as string[]).includes(value);
}

export type ProductionPhaseStatus = "pending" | "in_progress" | "done" | "skipped";

export const PHASE_STATUS_LABELS: Record<ProductionPhaseStatus, string> = {
  pending: "À venir",
  in_progress: "En cours",
  done: "Terminée",
  skipped: "Passée",
};

/** `cancelled` : arrêté depuis la carte — ni réussite, ni échec. */
export type GenerationJobStatus =
  | "pending"
  | "running"
  | "done"
  | "error"
  | "partial"
  | "cancelled";

export const JOB_STATUS_LABELS: Record<GenerationJobStatus, string> = {
  pending: "En file",
  running: "En cours",
  done: "Terminé",
  error: "En échec",
  partial: "Partiel",
  cancelled: "Arrêté",
};

/** Statuts sous lesquels la carte continue d'interroger le job. */
export const ACTIVE_JOB_STATUSES: GenerationJobStatus[] = ["pending", "running"];

// --- Lignes de la base -------------------------------------------------------

export type ClientPhase = {
  id: string;
  org_id: string;
  workspace_id: string;
  phase: ProductionPhase;
  /** Premier jour du mois cible, `YYYY-MM-01`. */
  target_month: string;
  status: ProductionPhaseStatus;
  completed_at: string | null;
  due_start: string | null;
  due_end: string | null;
  created_at: string;
  updated_at: string;
};

export type GenerationJob = {
  id: string;
  org_id: string;
  workspace_id: string;
  phase: ProductionPhase;
  target_month: string;
  status: GenerationJobStatus;
  progress_current: number;
  progress_total: number;
  result: GenerationJobResult | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Contenu de `generation_jobs.result`, par phase.
 *
 * Forme lâche assumée : le rapport markdown du reporting, les identifiants
 * créés par les intentions, les unités en échec du wording pour la reprise.
 */
export type GenerationJobResult = {
  /** Rapport markdown complet (phase reporting). */
  report?: string;
  /** Identifiants des publications créées (phase intentions). */
  created_subject_ids?: string[];
  /** Unités en échec, pour relancer uniquement celles-là (phase wording). */
  failed_subject_ids?: string[];
  /** Compte rendu lisible du worker, quel que soit le résultat. */
  summary?: string;
};

/**
 * La synthèse mensuelle produite par la phase Reporting (migration 0056).
 *
 * Elle vit à part du job qui l'a produite : un job est une trace d'exécution
 * purgée sans état d'âme, un bilan de mois se relit six mois plus tard. Et
 * elle reste **interne** — écrite par un modèle, elle sert à préparer le point
 * client, pas à le livrer.
 */
export type ClientReport = {
  id: string;
  org_id: string;
  workspace_id: string;
  /** Premier jour du mois analysé, `YYYY-MM-01`. */
  target_month: string;
  /** Le compte rendu en markdown, sortie brute du modèle. */
  report: string;
  /** Sur quoi il s'appuie réellement — la relecture doit pouvoir le savoir. */
  has_ads_data: boolean;
  has_organic_data: boolean;
  created_at: string;
  updated_at: string;
};

export type WordingHistoryEntry = {
  id: string;
  org_id: string;
  workspace_id: string;
  subject_id: string | null;
  hook: string;
  full_wording: string | null;
  platform: PlanningPlatform | null;
  published_at: string | null;
  created_at: string;
};
