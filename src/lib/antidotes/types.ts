/**
 * Modèle du pôle « Antidotes » — outbound et inbound.
 *
 * Aligné sur `supabase/migrations/20260907a_antidotes_schema.sql`. Alias de
 * type et non `interface` : TypeScript ne donne d'index signature implicite
 * qu'aux premiers, et postgrest-js en a besoin pour inférer les résultats de
 * requête.
 *
 * Chaque enum Postgres est miroité en union de littéraux, doublée d'un
 * `*_LABELS` français : ajouter une valeur en base casse la compilation du
 * libellé manquant, et c'est le garde-fou d'exhaustivité.
 */

// --- Campagnes ---------------------------------------------------------------

export type CampaignEngine = "maps" | "ecommerce";

export const CAMPAIGN_ENGINE_LABELS: Record<CampaignEngine, string> = {
  maps: "Lieu physique",
  ecommerce: "E-commerce",
};

// --- Prospects ---------------------------------------------------------------

export type ProspectSource = "maps" | "shopify" | "linkedin" | "inbound" | "manual";

export const PROSPECT_SOURCE_LABELS: Record<ProspectSource, string> = {
  maps: "Google Maps",
  shopify: "Shopify",
  linkedin: "LinkedIn",
  inbound: "Entrant",
  manual: "Saisie manuelle",
};

export type ProspectStatus =
  | "to_qualify"
  | "qualified"
  | "no_contact_found"
  | "contacted"
  | "replied"
  | "meeting"
  | "won"
  | "lost";

export const PROSPECT_STATUS_LABELS: Record<ProspectStatus, string> = {
  to_qualify: "À qualifier",
  qualified: "Qualifié",
  no_contact_found: "Sans contact",
  contacted: "Contacté",
  replied: "A répondu",
  meeting: "Rendez-vous",
  won: "Gagné",
  lost: "Perdu",
};

/**
 * L'ordre du cycle de vente — celui des colonnes du kanban, de gauche à
 * droite. Une sortie du flux (`no_contact_found`, `lost`) reste une colonne :
 * ce qu'on ne voit pas, on ne le corrige pas.
 */
export const PROSPECT_STATUSES: ProspectStatus[] = [
  "to_qualify",
  "qualified",
  "no_contact_found",
  "contacted",
  "replied",
  "meeting",
  "won",
  "lost",
];

export function isProspectStatus(value: string): value is ProspectStatus {
  return (PROSPECT_STATUSES as string[]).includes(value);
}

// --- Contacts ----------------------------------------------------------------

export type EmailStatus = "unknown" | "valid" | "risky" | "invalid";

export const EMAIL_STATUS_LABELS: Record<EmailStatus, string> = {
  unknown: "Non vérifiée",
  valid: "Valide",
  risky: "Incertaine",
  invalid: "Invalide",
};

export type Seniority = "founder" | "head_of" | "manager" | "other";

export const SENIORITY_LABELS: Record<Seniority, string> = {
  founder: "Fondateur·rice / dirigeant·e",
  head_of: "Directeur·rice",
  manager: "Responsable",
  other: "Autre",
};

export const SENIORITIES: Seniority[] = ["founder", "head_of", "manager", "other"];

export function isSeniority(value: string): value is Seniority {
  return (SENIORITIES as string[]).includes(value);
}

export type DiscoverySource =
  | "linkedin"
  | "legal_registry"
  | "website"
  | "inferred"
  | "manual";

export const DISCOVERY_SOURCE_LABELS: Record<DiscoverySource, string> = {
  linkedin: "LinkedIn",
  legal_registry: "Registre légal",
  website: "Site web",
  inferred: "Déduit",
  manual: "Saisie manuelle",
};

/** Dérivé du statut d'adresse en base — jamais saisi. */
export type OutreachChannel = "email" | "linkedin" | "none";

export const OUTREACH_CHANNEL_LABELS: Record<OutreachChannel, string> = {
  email: "Email",
  linkedin: "LinkedIn",
  none: "Aucun canal",
};

// --- Journal -----------------------------------------------------------------

export type InteractionType =
  | "email_sent"
  | "email_open"
  | "email_click"
  | "reply"
  | "call"
  | "note"
  | "linkedin_dm"
  | "meeting"
  | "bounce"
  | "opt_out";

export const INTERACTION_TYPE_LABELS: Record<InteractionType, string> = {
  email_sent: "Email envoyé",
  email_open: "Email ouvert",
  email_click: "Lien cliqué",
  reply: "Réponse reçue",
  call: "Appel",
  note: "Note",
  linkedin_dm: "Message LinkedIn",
  meeting: "Rendez-vous",
  bounce: "Email rebondi",
  opt_out: "Désinscription",
};

/**
 * Ce qu'on saisit soi-même depuis le panneau. Tout le reste est écrit par le
 * système — envoi, ouverture, clic, réponse, DM — et n'a pas de formulaire.
 */
export const MANUAL_INTERACTION_TYPES = ["note", "call"] as const;

export type ManualInteractionType = (typeof MANUAL_INTERACTION_TYPES)[number];

export function isManualInteractionType(value: string): value is ManualInteractionType {
  return (MANUAL_INTERACTION_TYPES as readonly string[]).includes(value);
}

// --- Séquences ---------------------------------------------------------------

export type EnrollmentStatus =
  | "active"
  | "paused"
  | "completed"
  | "stopped_on_reply"
  | "stopped_on_opt_out";

export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  active: "En cours",
  paused: "En pause",
  completed: "Terminée",
  stopped_on_reply: "Arrêtée sur réponse",
  stopped_on_opt_out: "Arrêtée sur désinscription",
};

// --- Inbound -----------------------------------------------------------------

export type GeneratedPostStatus = "draft" | "approved" | "published" | "rejected";

export const GENERATED_POST_STATUS_LABELS: Record<GeneratedPostStatus, string> = {
  draft: "Brouillon",
  approved: "Approuvé",
  published: "Publié",
  rejected: "Écarté",
};

export type PostPlatform = "linkedin" | "x" | "youtube" | "tiktok" | "instagram";

export const POST_PLATFORM_LABELS: Record<PostPlatform, string> = {
  linkedin: "LinkedIn",
  x: "X",
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
};

// --- Lignes de la base -------------------------------------------------------

/** Les poids du score, tels que `campaigns.filters.scoring` peut les porter. */
export type ScoringWeights = {
  ads_active: number;
  size_in_range: number;
  reachable_contact: number;
  same_sector: number;
};

export type CampaignFilters = {
  size_tolerance?: number;
  require_ads?: boolean | "bonus";
  countries?: string[];
  min_rating?: number;
  scoring?: Partial<ScoringWeights>;
  /**
   * Le client de référence, tel que le score le compare : son secteur exact
   * et sa taille dans le même signal que les prospects sourcés. Posés par
   * l'écran de campagne (phase 2) ; absents, ni la taille ni le secteur ne
   * rapportent de points.
   */
  reference_sector?: string | null;
  reference_size?: SizeSignal | null;
};

// --- Sourcing (phase 2) ------------------------------------------------------

/** Les trois sources de décisionnaire, en cascade — on s'arrête au premier nom. */
export type DiscoverySourceKey = "linkedin" | "legal_registry" | "website";

export const DISCOVERY_SOURCE_KEY_LABELS: Record<DiscoverySourceKey, string> = {
  linkedin: "LinkedIn (via Apify)",
  legal_registry: "Registre légal (SIREN)",
  website: "Site de la société",
};

/** Les fournisseurs d'adresse, dans l'ordre de la cascade. */
export type EmailProviderKey = "dropcontact" | "hunter" | "pattern";

export const EMAIL_PROVIDER_LABELS: Record<EmailProviderKey, string> = {
  dropcontact: "Dropcontact",
  hunter: "Hunter",
  pattern: "Déduction de motif",
};

/**
 * Les paramètres du moteur. Un lieu physique se cherche par mots-clés et
 * villes ; une boutique par catégorie, pays et trafic. Tout est optionnel en
 * base — les défauts vivent dans `sourcing/config.ts`.
 */
export type CampaignSourceParams = {
  keywords?: string[];
  cities?: string[];
  radius_km?: number;
  /** Plafond de lieux par recherche : c'est lui qui borne la facture Apify. */
  max_places?: number;
  category?: string;
  country?: string;
  traffic_min?: number | null;
  traffic_max?: number | null;
};

export type CampaignTargeting = {
  job_keywords?: string[];
  /** À partir de cet effectif, on vise le marketing plutôt que le dirigeant. */
  marketing_threshold?: number;
  discovery_sources?: { source: DiscoverySourceKey; enabled: boolean }[];
  enrichment_waterfall?: { provider: EmailProviderKey; enabled: boolean }[];
  verification_ttl_days?: number;
};

export type RunStatus = "queued" | "running" | "done" | "error";

export const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  queued: "En file",
  running: "En cours",
  done: "Terminé",
  error: "En erreur",
};

export type RunStage = "sourcing" | "discovering" | "verifying" | "done";

export const RUN_STAGE_LABELS: Record<RunStage, string> = {
  sourcing: "Sourcing",
  discovering: "Décisionnaires",
  verifying: "Adresses",
  done: "Terminé",
};

/** Le taux de survie d'un passage, étape par étape. */
export type RunStats = {
  sourced: number;
  qualified: number;
  /** Passés en « À qualifier » : un filtre n'a pas pu être évalué. */
  to_review: number;
  contact_found: number;
  email_valid: number;
  email_risky: number;
  /** Les rejets, comptés par raison. */
  rejected: Record<string, number>;
};

export type RunError = {
  at: string;
  step: string;
  message: string;
  prospect?: string;
};

export type CampaignRun = {
  id: string;
  org_id: string;
  campaign_id: string;
  status: RunStatus;
  stage: RunStage;
  stats: Partial<RunStats>;
  errors: RunError[];
  requested_at: string;
  started_at: string | null;
  finished_at: string | null;
  heartbeat_at: string | null;
  created_at: string;
};

/** Le verdict de qualification, tel que le prospect le garde. */
export type ProspectQualification = {
  outcome?: "qualified" | "to_review";
  reasons?: string[];
  size_ratio?: number | null;
  checked_at?: string;
};

/** L'avancement de l'enrichissement d'un prospect. */
export type ProspectEnrichment = {
  discovery_at?: string;
  discovery_source?: DiscoverySourceKey | null;
  candidates?: number;
  email_at?: string;
  email_provider?: EmailProviderKey | null;
  errors?: string[];
};

export type Campaign = {
  id: string;
  org_id: string;
  name: string;
  engine: CampaignEngine;
  reference_client: string | null;
  source_params: CampaignSourceParams;
  filters: CampaignFilters;
  targeting: CampaignTargeting;
  is_active: boolean;
  last_run_at: string | null;
  /** Le taux de survie du dernier passage, recopié pour la liste. */
  stats: Partial<RunStats>;
  created_at: string;
  updated_at: string;
};

/** Les signaux de taille, propres à chaque source. */
export type SizeSignal = {
  reviews_count?: number;
  employees?: number;
  revenue?: number;
  traffic?: number;
};

export type ExternalIds = {
  apify_run_id?: string;
  linkedin_url?: string;
  siren?: string;
  place_id?: string;
};

export type Prospect = {
  id: string;
  org_id: string;
  campaign_id: string | null;
  source: ProspectSource;
  company_name: string;
  website: string | null;
  /** ISO 3166-1 alpha-2, en majuscules. */
  country: string | null;
  city: string | null;
  sector: string | null;
  size_signal: SizeSignal;
  ads_active: boolean;
  ads_last_seen_at: string | null;
  status: ProspectStatus;
  /** 0-100, calculé par `scoring.ts` et persisté à chaque écriture. */
  score: number;
  reference_client: string | null;
  notes: string | null;
  external_ids: ExternalIds;
  /** Dernier geste de contact, entretenu par le trigger du journal. */
  last_contact_at: string | null;
  /** Note Google (0-5), quand la source la donne. */
  rating: number | null;
  phone: string | null;
  qualification: ProspectQualification;
  enrichment: ProspectEnrichment;
  /** Le passage de sourcing qui l'a posé ou touché en dernier. */
  last_run_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Contact = {
  id: string;
  org_id: string;
  prospect_id: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  email: string | null;
  email_status: EmailStatus;
  linkedin_url: string | null;
  phone: string | null;
  is_primary: boolean;
  seniority: Seniority;
  discovery_source: DiscoverySource;
  email_source: string | null;
  email_verified_at: string | null;
  opted_out: boolean;
  opted_out_at: string | null;
  /** Colonne générée en base : `valid` → email, `risky` → linkedin, sinon none. */
  outreach_channel: OutreachChannel;
  created_at: string;
  updated_at: string;
  /** Le jeton du lien de désinscription, généré en base (20260909a). */
  unsubscribe_token: string;
};

export type Interaction = {
  id: string;
  org_id: string;
  prospect_id: string;
  contact_id: string | null;
  type: InteractionType;
  payload: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
};

export type Sequence = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  /** Réglages à forme complète par défaut : `resolveSequenceSettings()`. */
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type SequenceStep = {
  id: string;
  org_id: string;
  sequence_id: string;
  position: number;
  /** Jours depuis l'inscription : J+0, J+4, J+9. */
  delay_days: number;
  subject_template: string;
  body_template: string;
  created_at: string;
};

/**
 * L'observation qui personnalise les emails d'une inscription — tirée du
 * site ou des publicités par le passage, ou écrite à la main.
 */
export type EnrollmentPersonalization = {
  observation?: string | null;
  observation_source?: "site" | "ads" | "manual" | "none";
  generated_at?: string;
  /** Vrai une fois l'observation cherchée, trouvée ou non : on ne recommence pas. */
  ready?: boolean;
  error?: string;
};

export type SequenceEnrollment = {
  id: string;
  org_id: string;
  sequence_id: string;
  contact_id: string;
  current_step: number;
  status: EnrollmentStatus;
  enrolled_at: string;
  next_send_at: string | null;
  /** Le canal figé à l'inscription : email, ou piste LinkedIn manuelle. */
  channel: OutreachChannel;
  personalization: EnrollmentPersonalization;
  /** Le fil Gmail de la conversation, dès le premier envoi. */
  thread_id: string | null;
  /** Le Message-ID du dernier envoi, pour répondre dans le fil. */
  last_message_id: string | null;
  last_sent_at: string | null;
  replied_at: string | null;
  stopped_at: string | null;
  paused_reason: string | null;
  last_error: string | null;
};

/** Les grandeurs brutes d'un post, telles que le réseau les rend. */
export type PostMetrics = {
  likes?: number;
  comments?: number;
  shares?: number;
  views?: number;
  /** Les abonnés de l'auteur au moment du relevé — le dénominateur du score relatif. */
  followers_at_collect?: number;
};

export type ReferencePost = {
  id: string;
  org_id: string;
  platform: PostPlatform;
  author_handle: string | null;
  content: string;
  url: string | null;
  metrics: PostMetrics;
  is_mine: boolean;
  /** pgvector sérialise en chaîne à travers PostgREST. */
  embedding: string | null;
  tags: string[];
  collected_at: string;
  created_at: string;
  /** Le compte veillé d'où vient le post (20260910a) ; nul pour mes propres posts. */
  account_id: string | null;
  published_at: string | null;
  /** `openai` — ou nul tant qu'aucun vecteur n'est calculé. */
  embedding_source: string | null;
};

export type TopicStatus = "new" | "used" | "dismissed";

export const TOPIC_STATUS_LABELS: Record<TopicStatus, string> = {
  new: "Proposé",
  used: "Utilisé",
  dismissed: "Écarté",
};

export type RadarAccount = {
  id: string;
  org_id: string;
  platform: PostPlatform;
  handle: string;
  url: string | null;
  label: string | null;
  followers: number | null;
  is_active: boolean;
  last_collected_at: string | null;
  last_error: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type TopicEvidence = { post_id: string; why: string };

export type RadarTopic = {
  id: string;
  org_id: string;
  title: string;
  angle: string | null;
  evidence: TopicEvidence[];
  score: number | null;
  status: TopicStatus;
  created_at: string;
};

/** Un exemple du corpus injecté dans le prompt d'un post généré. */
export type GeneratedExample = { post_id: string; similarity: number };

export type GeneratedPost = {
  id: string;
  org_id: string;
  source_post_id: string | null;
  topic: string | null;
  content: string;
  image_url: string | null;
  status: GeneratedPostStatus;
  published_at: string | null;
  linkedin_post_id: string | null;
  created_at: string;
  updated_at: string;
  topic_id: string | null;
  brief: string | null;
  examples: GeneratedExample[];
  image_prompt: string | null;
  published_url: string | null;
  error: string | null;
};

export type CaseStudy = {
  id: string;
  org_id: string;
  client_name: string;
  is_anonymized: boolean;
  anonymized_label: string | null;
  sector: string | null;
  problem: string | null;
  method: string | null;
  results: Record<string, unknown>;
  slug: string;
  published: boolean;
  created_at: string;
  updated_at: string;
};

// --- Modèles d'affichage -----------------------------------------------------

/**
 * Un prospect tel que le pipeline l'affiche : la ligne, ses contacts, et le
 * nom de sa campagne. Les interactions ne voyagent pas avec — elles ne se
 * lisent qu'au panneau, pour le seul prospect ouvert.
 */
export type PipelineProspect = Prospect & {
  contacts: Contact[];
  campaign_name: string | null;
};

/** Le nom complet d'un contact, ou son adresse, ou un tiret. */
export function contactDisplayName(contact: Pick<Contact, "first_name" | "last_name" | "email">): string {
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();
  return name || contact.email || "—";
}
