/**
 * Modèle du module Contexte client.
 *
 * Aligné sur `supabase/migrations/0032_client_context_schema.sql`. Alias de
 * type et non `interface` : TypeScript ne donne d'index signature implicite
 * qu'aux premiers, et postgrest-js en a besoin pour inférer les résultats de
 * requête.
 */

// --- Types de document ------------------------------------------------------

export type ClientAssetType =
  | "website"
  | "questionnaire"
  | "strategy"
  | "lookbook"
  | "guidelines"
  | "benchmark"
  | "other";

export const ASSET_TYPE_LABELS: Record<ClientAssetType, string> = {
  website: "Site web",
  questionnaire: "Questionnaire",
  strategy: "Stratégie",
  lookbook: "Lookbook",
  guidelines: "Charte",
  benchmark: "Benchmark",
  other: "Autre",
};

export const ASSET_TYPES = Object.keys(ASSET_TYPE_LABELS) as ClientAssetType[];

export function isClientAssetType(value: string): value is ClientAssetType {
  return value in ASSET_TYPE_LABELS;
}

export type ClientAssetExtractionStatus = "pending" | "running" | "done" | "error";

export const EXTRACTION_STATUS_LABELS: Record<ClientAssetExtractionStatus, string> = {
  pending: "En attente d'analyse",
  running: "Analyse en cours",
  done: "Analysé",
  error: "Analyse en échec",
};

// --- Étape de génération du wording d'une publication ------------------------

export type PlanningWordingStatus = "pending" | "generated" | "validated";

export const WORDING_STATUS_LABELS: Record<PlanningWordingStatus, string> = {
  pending: "À générer",
  generated: "Généré",
  validated: "Validé",
};

// --- Contenu du brief --------------------------------------------------------

/**
 * Un pilier de contenu. Les clés restent en français : c'est une donnée
 * produit, injectée telle quelle dans les prompts de génération — pas un
 * identifiant de code.
 */
export type ContextPillar = {
  nom: string;
  description: string;
  formats: string[];
  angles: string[];
  frequence: string;
};

/**
 * Une ligne de livrable mensuel : une catégorie de publication et sa
 * quantité. La catégorie est libre — « Stories », « Reels », « Post fixe »
 * sont des suggestions, pas une liste fermée : chaque contrat a ses mots.
 */
export type ContextDeliverableLine = {
  categorie: string;
  quantite: number;
};

/** Ce qu'on doit au client chaque mois. Clés en français, comme les piliers. */
export type ContextDeliverables = {
  /** Quand les intentions lui sont livrées : « le 20 du mois précédent ». */
  intentions: string;
  publications: ContextDeliverableLine[];
};

/** Proposées dans la liste de saisie, sans jamais contraindre le champ. */
export const DELIVERABLE_CATEGORIES = [
  "Post fixe",
  "Carrousel",
  "Reels",
  "Stories",
  "Vidéo",
  "Article",
] as const;

/** Règles d'écriture par réseau, clé = réseau en minuscules. */
export type ContextPlatformRules = Record<string, string>;

/** Les réseaux proposés d'office dans l'éditeur ; d'autres peuvent s'ajouter. */
export const PLATFORM_KEYS = ["instagram", "facebook", "linkedin", "tiktok"] as const;

/** Les six champs texte du brief, éditables en place. */
export type ContextTextField =
  | "main_context"
  | "positioning"
  | "audience"
  | "tone_of_voice"
  | "mentions"
  | "restrictions";

export const TEXT_FIELD_LABELS: Record<ContextTextField, string> = {
  main_context: "Contexte principal",
  positioning: "Positionnement",
  audience: "Cibles",
  tone_of_voice: "Tone of voice",
  mentions: "Mentions",
  restrictions: "Interdits",
};

export const TEXT_FIELDS = Object.keys(TEXT_FIELD_LABELS) as ContextTextField[];

export function isContextTextField(value: string): value is ContextTextField {
  return value in TEXT_FIELD_LABELS;
}

/** Tous les champs comparés par le diff de régénération. */
export type ContextFieldKey = ContextTextField | "pillars" | "platforms";

export const FIELD_LABELS: Record<ContextFieldKey, string> = {
  ...TEXT_FIELD_LABELS,
  pillars: "Piliers de contenu",
  platforms: "Règles par plateforme",
};

export const FIELD_KEYS = Object.keys(FIELD_LABELS) as ContextFieldKey[];

// --- Lignes de base ----------------------------------------------------------

export type ClientContext = {
  id: string;
  workspace_id: string;
  version: number;
  is_active: boolean;
  main_context: string | null;
  positioning: string | null;
  audience: string | null;
  tone_of_voice: string | null;
  pillars: ContextPillar[];
  mentions: string | null;
  restrictions: string | null;
  platforms: ContextPlatformRules;
  deliverables: ContextDeliverables;
  created_at: string;
  created_by: string | null;
};

export type ClientAsset = {
  id: string;
  workspace_id: string;
  name: string;
  type: ClientAssetType;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  summary: string | null;
  summary_edited_manually: boolean;
  include_in_context: boolean;
  extraction_status: ClientAssetExtractionStatus;
  extraction_error: string | null;
  created_at: string;
};

/**
 * `wording_history` n'est pas déclarée ici : la table appartient au module
 * Production, qui l'a posée, et son type vit dans `src/lib/production/types.ts`.
 * Le Contexte s'y branche pour historiser une accroche à la validation d'un
 * wording — la colonne s'appelle `hook`, jamais `accroche`.
 */
export type { WordingHistoryEntry } from "@/lib/production/types";

// --- Proposition de consolidation --------------------------------------------

/**
 * Les valeurs proposées par la consolidation, champ par champ — jamais
 * appliquées sans passer par le diff. Mêmes clés que `ClientContext`, sans
 * les colonnes techniques.
 */
export type ContextProposal = {
  main_context: string;
  positioning: string;
  audience: string;
  tone_of_voice: string;
  pillars: ContextPillar[];
  mentions: string;
  restrictions: string;
  platforms: ContextPlatformRules;
};
