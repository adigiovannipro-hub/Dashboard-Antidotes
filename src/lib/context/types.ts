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
  /**
   * Ce que le pilier doit produire côté business, et les seuls appels à
   * l'action autorisés dessus. Optionnels : `pillars` est un `jsonb` peuplé
   * depuis 0032, et les piliers déjà écrits doivent rester valides sans
   * backfill — c'est pour ça que 20260913c n'ajoute aucune colonne.
   */
  objectif_business?: string;
  cta_autorises?: string[];
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

/**
 * Un réseau du client et ce qu'on y publie chaque mois.
 *
 * Le volume se compte réseau par réseau parce qu'il se contracte comme ça :
 * quatre posts et huit stories sur Instagram n'ont rien à voir avec les deux
 * articles LinkedIn du même client. Un réseau déclaré sans ligne reste
 * légitime — il est au contrat, ses quantités ne sont pas encore posées.
 */
export type ContextNetworkDeliverables = {
  nom: string;
  publications: ContextDeliverableLine[];
};

/** Ce qu'on doit au client chaque mois. Clés en français, comme les piliers. */
export type ContextDeliverables = {
  /** Quand les intentions lui sont livrées : « le 20 du mois précédent ». */
  intentions: string;
  /**
   * Les réseaux sur lesquels ce client publie, chacun avec ses quantités.
   * Déclarés une fois ici, ils commandent les règles d'écriture par
   * plateforme : un client qui n'est que sur Instagram n'a rien à faire d'un
   * champ TikTok, et la génération n'a pas à deviner sur quoi elle écrit.
   */
  reseaux: ContextNetworkDeliverables[];
  /**
   * Ce qui n'est rattaché à aucun réseau : une newsletter, un livrable repris
   * d'un contrat écrit avant que la répartition existe. On ne devine pas à
   * quel réseau l'attribuer, on le montre à part.
   */
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

/**
 * Les réseaux proposés à la sélection. Ce n'est **pas** la liste des réseaux
 * d'un client : celle-là se déclare dans les livrables, et rien n'oblige à
 * s'y tenir — un réseau absent d'ici s'ajoute à la main.
 */
/**
 * « Meta » vient en premier, et c'est un choix : c'est ainsi qu'on vend, qu'on
 * planifie et qu'on publie. Un couloir Meta part sur Instagram **et** Facebook
 * d'un seul geste (`publishing/readiness.ts`), et déclarer Meta réclame les
 * trois comptes — Instagram, Page, compte publicitaire — d'un coup. Déclarer
 * Instagram et Facebook séparément reste possible pour un client qui les
 * traite vraiment à part.
 */
export const NETWORK_SUGGESTIONS = [
  "Meta",
  "Instagram",
  "Facebook",
  "LinkedIn",
  "TikTok",
  "YouTube",
  "Pinterest",
  "X",
  "Threads",
] as const;

/** Clé de stockage d'un réseau : minuscules, sans accent ni espace. */
export function networkKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

/**
 * Les champs texte du brief, éditables en place.
 *
 * `positioning` et `mentions` ont été retirés par 20260913c, sans rien perdre :
 * le positionnement décrivait la même chose que le contexte principal en deux
 * cartes, il est recopié à la fin de « La marque » ; les mentions sont une
 * règle d'écriture, elles sont recopiées dans la règle de chaque réseau
 * déclaré. `client_feedback` arrive avec la même migration.
 */
export type ContextTextField =
  | "main_context"
  | "audience"
  | "tone_of_voice"
  | "restrictions"
  | "client_feedback";

export const TEXT_FIELD_LABELS: Record<ContextTextField, string> = {
  main_context: "La marque",
  audience: "Cibles",
  tone_of_voice: "Tone of voice",
  restrictions: "Interdits",
  client_feedback: "Retours du client",
};

export const TEXT_FIELDS = Object.keys(TEXT_FIELD_LABELS) as ContextTextField[];

export function isContextTextField(value: string): value is ContextTextField {
  return value in TEXT_FIELD_LABELS;
}

/**
 * Les champs comparés par le diff de régénération — donc les seuls que la
 * consolidation a le droit de proposer.
 *
 * `client_feedback` n'en fait pas partie, et c'est la règle de la maison :
 * les retours du client sont une saisie humaine, comme les livrables
 * contractuels, les exemples validés et les faits sourcés. Un modèle qui
 * proposerait de réécrire ce que le client a dit fabriquerait un faux verbatim.
 */
export type ContextFieldKey =
  | "main_context"
  | "audience"
  | "tone_of_voice"
  | "restrictions"
  | "pillars"
  | "platforms";

export const FIELD_LABELS: Record<ContextFieldKey, string> = {
  main_context: TEXT_FIELD_LABELS.main_context,
  audience: TEXT_FIELD_LABELS.audience,
  tone_of_voice: TEXT_FIELD_LABELS.tone_of_voice,
  restrictions: TEXT_FIELD_LABELS.restrictions,
  pillars: "Piliers de contenu",
  platforms: "Règles par plateforme",
};

export const FIELD_KEYS = Object.keys(FIELD_LABELS) as ContextFieldKey[];

// --- Matière humaine : exemples validés et faits sourcés ---------------------

/**
 * Une publication réellement parue et approuvée par le client, collée brute.
 * Injectée **entière** dans les prompts : c'est le registre à reproduire, un
 * résumé n'apprendrait rien au modèle sur la façon d'écrire.
 */
export type ValidatedExample = {
  /** Réseau, tel que l'agence l'écrit — même vocabulaire que les livrables. */
  reseau: string;
  texte: string;
};

/**
 * Un fait vérifiable et sa preuve. `verifie_le` est une date ISO et jamais un
 * texte : l'écran marque en ambre ce qui dépasse six mois, et « septembre » ne
 * se compare pas.
 */
export type SourcedFact = {
  fait: string;
  source: string;
  /** `YYYY-MM-DD`. */
  verifie_le: string;
};

/** 3 à 5 exemples : au-delà, le registre se dilue et le budget de tokens part. */
export const VALIDATED_EXAMPLES_TARGET = { min: 3, max: 5 } as const;

// --- Pilotage de la génération (non versionné) --------------------------------

/**
 * La ligne de `client_generation_settings` (20260913c) : ce qui décrit le
 * **moment** et non la marque, donc ce qui n'a rien à faire dans un brief
 * versionné. Une ligne par espace, owner-only.
 */
export type ClientGenerationSettings = {
  workspace_id: string;
  permanent_instructions: string | null;
  monthly_instruction: string | null;
  /** `YYYY-MM-01` : le mois que la consigne vise, jamais l'un sans l'autre. */
  monthly_instruction_month: string | null;
  temporal_context: string | null;
  temporal_context_at: string | null;
  updated_at: string;
  updated_by: string | null;
};

// --- Lignes de base ----------------------------------------------------------

export type ClientContext = {
  id: string;
  workspace_id: string;
  version: number;
  is_active: boolean;
  main_context: string | null;
  audience: string | null;
  tone_of_voice: string | null;
  pillars: ContextPillar[];
  restrictions: string | null;
  platforms: ContextPlatformRules;
  deliverables: ContextDeliverables;
  validated_examples: ValidatedExample[];
  client_feedback: string | null;
  sourced_facts: SourcedFact[];
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
  audience: string;
  tone_of_voice: string;
  pillars: ContextPillar[];
  restrictions: string;
  platforms: ContextPlatformRules;
};
