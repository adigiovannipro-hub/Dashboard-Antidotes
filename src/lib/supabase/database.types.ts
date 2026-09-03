/**
 * Types de la base, maintenus à la main tant que la CLI Supabase n'est pas
 * branchée. Ils doivent rester alignés sur `supabase/migrations/`.
 *
 * Une fois la CLI configurée, ce fichier sera régénéré par :
 *   supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
 */

export type WorkspaceType = "personal" | "business" | "client";
export type OrgRole = "owner" | "member";
export type WorkspaceRole = "contributor" | "client";
export type InvitationRole = "owner" | "contributor" | "client";
export type DataProvider =
  | "meta_ads"
  | "meta_organic"
  | "tiktok_ads"
  | "tiktok_organic"
  // 0060 — Google Analytics 4, lu à travers Composio.
  | "google_analytics"
  // 20260902c — LinkedIn organique, lu à travers Composio.
  | "linkedin_organic";
export type DataSourceStatus = "pending" | "connected" | "error" | "disabled";
export type SyncStatus = "running" | "success" | "error";
export type AdLevel = "campaign" | "adset" | "ad";
export type BreakdownType = "age" | "gender" | "region";
export type SocialPlatform =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "linkedin"
  | "youtube"
  | "x";

export type Workspace = {
  id: string;
  org_id: string;
  type: WorkspaceType;
  slug: string;
  name: string;
  logo_url: string | null;
  accent_color: string | null;
  created_at: string;
}

export type Organization = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export type Membership = {
  user_id: string;
  workspace_id: string;
  role: WorkspaceRole;
  created_at: string;
}

export type OrganizationMember = {
  org_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
}

export type Invitation = {
  id: string;
  email: string;
  org_id: string;
  workspace_id: string | null;
  role: InvitationRole;
  first_name: string | null;
  last_name: string | null;
  invited_by: string | null;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export type DataSource = {
  id: string;
  workspace_id: string;
  provider: DataProvider;
  external_account_id: string;
  display_name: string | null;
  credentials_encrypted: string | null;
  status: DataSourceStatus;
  backfill_from: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  /* Événements pixel personnalisés comptés comme achats — 0053. Réglage par
     compte : « Résa Confirmée » est une vente chez I-WAY, pas ailleurs. */
  purchase_event_names: string[];
  /* Et ceux comptés comme mises au panier — 0054. Chez I-WAY, « Validation
     Resa » est un panier, « Validation Shop » une vente : un seul rôle ne
     suffisait pas. */
  add_to_cart_event_names: string[];
  created_at: string;
}

export type SyncRun = {
  id: string;
  data_source_id: string;
  workspace_id: string;
  status: SyncStatus;
  started_at: string;
  finished_at: string | null;
  date_from: string | null;
  date_to: string | null;
  rows_ingested: number;
  error: string | null;
}

export type AdEntity = {
  id: string;
  data_source_id: string;
  workspace_id: string;
  level: AdLevel;
  external_id: string;
  parent_external_id: string | null;
  name: string;
  status: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Un événement pixel **personnalisé** — 0051. Le nom appartient au client :
 * « Validation Shop Lyon ». Tenu à part des métriques standards parce qu'une
 * validation de boutique n'est pas un achat, et qu'un ROAS bâti dessus serait
 * un chiffre d'affaires que personne n'a encaissé.
 */
export type AdCustomEventDaily = {
  data_source_id: string;
  workspace_id: string;
  entity_id: string;
  date: string;
  event_name: string;
  count: number;
  /** Zéro signifie « sans montant », jamais « gratuit ». */
  value: number;
  updated_at: string;
};

export type AdMetricsDaily = {
  data_source_id: string;
  workspace_id: string;
  entity_id: string;
  date: string;
  spend: number;
  impressions: number;
  // 0045 — portée au grain jour (approximation additive, comme Supermetrics)
  // et marches de l'entonnoir.
  reach: number;
  clicks: number;
  link_clicks: number;
  purchases: number;
  purchase_value: number;
  landing_page_views: number;
  add_to_cart: number;
  initiated_checkout: number;
  comments: number;
  saves: number;
  shares: number;
  // 0066 — vues (3 s) et lectures complètes des vidéos publicitaires.
  video_views: number;
  video_completions: number;
  updated_at: string;
}

export type AdBreakdownDaily = {
  data_source_id: string;
  workspace_id: string;
  date: string;
  type: BreakdownType;
  value: string;
  spend: number;
  impressions: number;
  clicks: number;
  updated_at: string;
}

export type SocialFollowers = {
  data_source_id: string;
  workspace_id: string;
  platform: SocialPlatform;
  date: string;
  followers_count: number;
  source: string;
  updated_at: string;
}

// 0069 — statistiques de Page au grain jour, là où Meta ne rend plus les
// métriques par publication. Grandeurs additives seulement.
export type SocialPageDaily = {
  data_source_id: string;
  workspace_id: string;
  platform: SocialPlatform;
  date: string;
  impressions: number;
  reach: number;
  engagements: number;
  video_views: number;
  // 20260902f — les quatre grandeurs que LinkedIn rend au grain jour et que
  // Meta ne rend pas. À zéro sur les lignes Meta.
  clicks: number;
  likes: number;
  comments: number;
  shares: number;
  // 20260902g — les vues de la page elle-même. `unique_page_views` n'est pas
  // additive : elle ne se somme jamais sur une période.
  page_views: number;
  unique_page_views: number;
  jobs_page_views: number;
  updated_at: string;
}

export type SocialPost = {
  id: string;
  data_source_id: string;
  workspace_id: string;
  platform: SocialPlatform;
  external_id: string;
  published_at: string;
  caption: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  // 0047 — reel, carrousel ou post fixe.
  media_kind: "image" | "carousel" | "video";
  // 0048 — mesurées, jamais déduites des impressions.
  video_views: number;
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  // 20260902f — les clics par publication, que LinkedIn rend et Meta non.
  clicks: number;
  updated_at: string;
}

// --- Trafic web (migration 0060) --------------------------------------------
// Deux grains, à dessein : le jour porte les courbes et les sommes additives,
// le mois civil porte les visiteurs uniques que GA4 dédoublonne par période —
// additionner des uniques quotidiens surcompterait un visiteur revenu deux
// jours de suite.

export type WebBreakdownType = "source" | "device" | "city" | "retention";

export type WebMetricsDaily = {
  data_source_id: string;
  workspace_id: string;
  date: string;
  /** Uniques du jour — leur somme sur une période est une approximation haute. */
  total_users: number;
  sessions: number;
  /** Sessions engagées GA4 : le complément du taux de rebond. */
  engaged_sessions: number;
  page_views: number;
  /** Durée cumulée des sessions du jour, en secondes (moyenne × sessions). */
  session_seconds: number;
  updated_at: string;
};

export type WebMetricsMonthly = {
  data_source_id: string;
  workspace_id: string;
  /** Le 1ᵉʳ du mois civil. */
  month: string;
  /** Uniques du mois, dédoublonnés par GA : le chiffre du rapport. */
  total_users: number;
  new_users: number;
  // 0062 — les totaux exacts du mois : même les sessions ne se somment pas
  // parfaitement depuis le quotidien (GA recoupe à minuit).
  sessions: number;
  engaged_sessions: number;
  page_views: number;
  session_seconds: number;
  updated_at: string;
};

export type WebBreakdownMonthly = {
  data_source_id: string;
  workspace_id: string;
  month: string;
  type: WebBreakdownType;
  /** La valeur telle que GA la rend : « tiktok », « mobile », « (not set) ». */
  value: string;
  users: number;
  sessions: number;
  updated_at: string;
};

export type WebPageMonthly = {
  data_source_id: string;
  workspace_id: string;
  month: string;
  path: string;
  views: number;
  sessions: number;
  engaged_sessions: number;
  session_seconds: number;
  updated_at: string;
};

export type Dashboard = {
  id: string;
  workspace_id: string;
  slug: string;
  name: string;
  layout: Record<string, unknown>;
  position: number;
  created_at: string;
  updated_at: string;
}

export type ShareLink = {
  id: string;
  dashboard_id: string;
  workspace_id: string;
  token: string;
  password_hash: string | null;
  date_mode: string;
  date_from: string | null;
  date_to: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_by: string | null;
  created_at: string;
}

export type AuditLogEntry = {
  id: number;
  actor_id: string | null;
  org_id: string | null;
  workspace_id: string | null;
  action: string;
  target: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}


// --- Module Modération ------------------------------------------------------
// Sous-ensemble des tables réellement lues côté application. Les tables
// d'exploitation (webhook_deliveries, monday_imports) passent par le
// service_role et n'ont pas besoin d'être typées ici.

export type ModerationClientRow = {
  id: string;
  org_id: string;
  workspace_id: string | null;
  slug: string;
  name: string;
  locale_default: string;
  locales_active: string[];
  tone_settings: Record<string, unknown>;
  auto_send_settings: Record<string, unknown>;
  retention_days: number | null;
  archived_at: string | null;
  created_at: string;
}

export type ModerationMemberRow = {
  user_id: string;
  client_id: string;
  role: string;
  requires_approval: boolean;
  created_at: string;
}

export type ConversationRow = {
  id: string;
  client_id: string;
  connection_id: string | null;
  channel: string;
  external_thread_id: string;
  kind: string;
  participant_external_id: string | null;
  participant_handle: string | null;
  participant_avatar_url: string | null;
  status: string;
  priority: string;
  unread: boolean;
  flags: string[];
  detected_locale: string | null;
  excerpt: string | null;
  post_external_id: string | null;
  post_permalink: string | null;
  post_excerpt: string | null;
  post_thumbnail_url: string | null;
  message_count: number;
  last_message_at: string;
  response_window_expires_at: string | null;
  human_agent_tag_used: boolean;
  locked_by: string | null;
  locked_at: string | null;
  lock_expires_at: string | null;
  deleted_at: string | null;
  created_at: string;
}

export type ModerationMessageRow = {
  id: string;
  conversation_id: string;
  client_id: string;
  direction: string;
  external_message_id: string | null;
  author_external_id: string | null;
  author_handle: string | null;
  body: string;
  attachments: unknown[];
  origin: string;
  sent_at: string;
  created_at: string;
}

export type DraftRow = {
  id: string;
  conversation_id: string;
  client_id: string;
  body: string;
  locale: string;
  confidence: number | null;
  model: string | null;
  prompt_version: string | null;
  status: string;
  sources: unknown[];
  translated_from_fr: boolean;
  auto_sent: boolean;
  auto_send_rule: unknown | null;
  bad_auto_reply: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  sent_at: string | null;
  send_error: string | null;
  created_at: string;
}

export type FaqEntryRow = {
  id: string;
  client_id: string;
  title: string | null;
  question_canonical: string;
  variants: string[];
  answer_fr: string | null;
  answer_en: string | null;
  answer_tiktok: string | null;
  client_review: "pending" | "approved" | "rejected" | null;
  client_reviewed_at: string | null;
  category_id: string | null;
  channels: string[];
  priority: number;
  active: boolean;
  confidence: number;
  usage_count: number;
  direct_validation_count: number;
  correction_count: number;
  embedding_source: string | null;
  monday_item_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type FaqCategoryRow = {
  id: string;
  client_id: string;
  name: string;
  position: number;
}

export type FaqEntryVersionRow = {
  id: string;
  faq_entry_id: string;
  client_id: string;
  version: number;
  snapshot: Record<string, unknown>;
  diff: Record<string, unknown>;
  author_id: string | null;
  reason: string | null;
  created_at: string;
}

export type StoryMentionRow = {
  id: string;
  client_id: string;
  channel: string;
  external_id: string;
  author_handle: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  published_at: string;
  expires_at: string | null;
  status: string;
  reshare_supported: boolean;
  handled_by: string | null;
  handled_at: string | null;
  created_at: string;
}

export type ChannelConnectionRow = {
  id: string;
  client_id: string;
  channel: string;
  external_account_id: string;
  display_name: string | null;
  credentials_encrypted: string | null;
  token_expires_at: string | null;
  ingestion_mode: string;
  poll_interval_seconds: number;
  status: string;
  last_polled_at: string | null;
  last_error: string | null;
  created_at: string;
}

export type ModerationAuditRow = {
  id: number;
  actor_id: string | null;
  client_id: string | null;
  channel: string | null;
  conversation_id: string | null;
  faq_entry_id: string | null;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
}

// --- Planning Éditorial (migrations 0006 à 0008) -----------------------------

export type PlanningBoardRow = {
  id: string;
  workspace_id: string;
  kind: string;
  slug: string;
  name: string;
  year: number | null;
  position: number;
  settings: Record<string, unknown>;
  created_at: string;
};

export type PlanningMonthRow = {
  id: string;
  board_id: string;
  workspace_id: string;
  label: string;
  month: string;
  position: number;
  /** Corbeille (migration 0031) — `null` : visible au tableau. */
  deleted_at: string | null;
  created_at: string;
};

export type PlanningLaneRow = {
  id: string;
  month_id: string;
  board_id: string;
  workspace_id: string;
  platform: string;
  name: string;
  position: number;
  external_id: string | null;
  created_at: string;
};

export type PlanningSubjectRow = {
  id: string;
  lane_id: string;
  month_id: string;
  board_id: string;
  workspace_id: string;
  name: string;
  status: string;
  format: string;
  scheduled_on: string | null;
  wording: string | null;
  sponsoring: number | null;
  ad_objective: string | null;
  ad_status: string | null;
  owner_id: string | null;
  visual_urls: string[];
  custom: Record<string, unknown>;
  position: number;
  external_id: string | null;
  /** Archives et corbeille (migration 0031) — `null` : visible au tableau. */
  archived_at: string | null;
  deleted_at: string | null;
  /** Résultats de génération (migration 0032). */
  visual_text: string | null;
  slides: unknown[] | null;
  wording_status: string;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

export type PlanningColumnRow = {
  id: string;
  board_id: string;
  workspace_id: string;
  builtin_key: string | null;
  type: string | null;
  label: string | null;
  position: number | null;
  hidden: boolean;
  settings: Record<string, unknown>;
  width: number | null;
  created_at: string;
};

export type PlanningActivityRow = {
  id: number;
  subject_id: string;
  workspace_id: string;
  actor_id: string | null;
  field: string;
  before: string | null;
  after: string | null;
  created_at: string;
};

// 0046 — journal et verrou de la publication automatique.
export type PlanningPublicationRow = {
  id: string;
  subject_id: string;
  workspace_id: string;
  target: "instagram" | "facebook";
  status: "running" | "success" | "error";
  external_id: string | null;
  permalink: string | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
};

export type PlanningCommentRow = {
  id: string;
  subject_id: string;
  workspace_id: string;
  author_id: string | null;
  scope: string;
  body: string;
  /** Adresses prévenues par e-mail à l'écriture du retour (migration 0030). */
  mentions: string[];
  created_at: string;
};

export type PlanningFaqEntryRow = {
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

/* --- Module Reçus ---------------------------------------------------------
   Le détail de ces lignes vit dans `src/lib/recus/types.ts`, au plus près du
   code qui les manipule. Réexportées ici pour que postgrest-js infère les
   requêtes, sans dupliquer la définition. */
export type {
  ReceiptSource as ReceiptSourceRow,
  ReceiptExpense as ReceiptExpenseRow,
  ReceiptDocument as ReceiptDocumentRow,
  ReceiptMerchantRule as ReceiptMerchantRuleRow,
  ReceiptEvent as ReceiptEventRow,
} from "@/lib/recus/types";

import type {
  ReceiptDocument,
  ReceiptEvent,
  ReceiptExpense,
  ReceiptMerchantRule,
  ReceiptSource,
} from "@/lib/recus/types";

/* --- Module Finance -------------------------------------------------------
   Même principe : le détail vit dans `src/lib/finance/types.ts`. */
export type {
  FinanceMerchantLogo as FinanceMerchantLogoRow,
  FinanceRetrievalSource as FinanceRetrievalSourceRow,
  FinanceAccount as FinanceAccountRow,
  FinanceBalanceSnapshot as FinanceBalanceSnapshotRow,
  FinanceInvoice as FinanceInvoiceRow,
  FinanceCategory as FinanceCategoryRow,
  FinanceCategoryRule as FinanceCategoryRuleRow,
  FinanceTransaction as FinanceTransactionRow,
  FinanceLedgerEntry as FinanceLedgerEntryRow,
  FinanceReceipt as FinanceReceiptRow,
  FinanceSyncRun as FinanceSyncRunRow,
} from "@/lib/finance/types";

import type {
  FinanceMerchantLogo,
  FinanceRetrievalSource,
  FinanceAccount,
  FinanceBalanceSnapshot,
  FinanceCategory,
  FinanceCategoryRule,
  FinanceInvoice,
  FinanceLedgerEntry,
  FinanceReceipt,
  FinanceSyncRun,
  FinanceTransaction,
} from "@/lib/finance/types";

/* --- Module Échéances de facturation ---------------------------------------
   Même principe : le détail vit dans `src/lib/billing/types.ts`. */
export type {
  BillingClientAlias as BillingClientAliasRow,
  BillingEngagement as BillingEngagementRow,
  BillingInstallment as BillingInstallmentRow,
} from "@/lib/billing/types";

import type {
  BillingClientAlias,
  BillingEngagement,
  BillingInstallment,
} from "@/lib/billing/types";

/* --- Module Mon travail ----------------------------------------------------
   Même principe : le détail vit dans `src/lib/mon-travail/types.ts`. */
export type {
  WorkCycle as WorkCycleRow,
  WorkCycleStep as WorkCycleStepRow,
  WorkTask as WorkTaskRow,
} from "@/lib/mon-travail/types";

import type { WorkCycle, WorkCycleStep, WorkTask } from "@/lib/mon-travail/types";

/* --- Module Contexte client ------------------------------------------------
   Même principe : le détail vit dans `src/lib/context/types.ts`. */
export type {
  ClientContext as ClientContextRow,
  ClientAsset as ClientAssetRow,
} from "@/lib/context/types";

import type { ClientAsset, ClientContext } from "@/lib/context/types";

/* --- Droits par page, à l'intérieur d'un espace --------------------------- */
export type { WorkspacePageGrant as WorkspacePageGrantRow } from "@/lib/workspaces/types";

import type { WorkspacePageGrant } from "@/lib/workspaces/types";

/* --- Module Production -----------------------------------------------------
   Même principe : le détail vit dans `src/lib/production/types.ts`.

   `wording_history` est déclarée **ici et pas dans le Contexte** : c'est la
   Production qui a posé la table, et sa forme fait foi. Le Contexte s'y
   branche pour historiser une accroche validée. */
export type {
  ClientPhase as ClientPhaseRow,
  ClientReport as ClientReportRow,
  GenerationJob as GenerationJobRow,
  WordingHistoryEntry as WordingHistoryRow,
} from "@/lib/production/types";

import type {
  ClientPhase,
  ClientReport,
  GenerationJob,
  WordingHistoryEntry,
} from "@/lib/production/types";

/* --- Comptes sociaux ---------------------------------------------------------
   Le détail vit dans `src/lib/social/types.ts`, aligné sur les migrations 0043
   et 0044. Le secret n'a pas de type exporté : il ne se lit que depuis le
   serveur, au moment de publier. */
export type {
  SocialAccountRow as SocialAccount,
  WorkspaceSocialLink,
} from "@/lib/social/types";

import type {
  SocialAccountRow as SocialAccount,
  WorkspaceSocialLink,
} from "@/lib/social/types";

export type SocialAccountSecret = {
  account_id: string;
  org_id: string;
  credentials_encrypted: string | null;
  token_expires_at: string | null;
  scopes: string[];
  updated_at: string;
};

/* --- Module Academy ---------------------------------------------------------
   Même principe : le détail vit dans `src/lib/academy/types.ts`, aligné sur
   les migrations 0056, 0057 et 20260903a-c. */
export type {
  AcademyCourse as AcademyCourseRow,
  AcademyModule as AcademyModuleRow,
  AcademyLesson as AcademyLessonRow,
  AcademyProgress as AcademyProgressRow,
  AcademyNote as AcademyNoteRow,
  AcademyEnrollment as AcademyEnrollmentRow,
  AcademyVideoProvider,
  AcademyProgressStatus,
  AcademyEnrollmentStatus,
} from "@/lib/academy/types";

import type {
  AcademyCourse,
  AcademyEnrollment,
  AcademyEnrollmentStatus,
  AcademyLesson,
  AcademyModule,
  AcademyNote,
  AcademyProgress,
  AcademyProgressStatus,
  AcademyVideoProvider,
} from "@/lib/academy/types";

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile>;
      organizations: Table<Organization>;
      organization_members: Table<OrganizationMember>;
      workspaces: Table<Workspace>;
      memberships: Table<Membership>;
      invitations: Table<Invitation>;
      data_sources: Table<DataSource>;
      sync_runs: Table<SyncRun>;
      ad_entities: Table<AdEntity>;
      ad_metrics_daily: Table<AdMetricsDaily>;
      ad_breakdowns_daily: Table<AdBreakdownDaily>;
      ad_custom_events_daily: Table<AdCustomEventDaily>;
      social_followers: Table<SocialFollowers>;
      social_page_daily: Table<SocialPageDaily>;
      social_posts: Table<SocialPost>;
      web_metrics_daily: Table<WebMetricsDaily>;
      web_metrics_monthly: Table<WebMetricsMonthly>;
      web_breakdowns_monthly: Table<WebBreakdownMonthly>;
      web_pages_monthly: Table<WebPageMonthly>;
      dashboards: Table<Dashboard>;
      share_links: Table<ShareLink>;
      audit_log: Table<AuditLogEntry>;
      moderation_clients: Table<ModerationClientRow>;
      moderation_members: Table<ModerationMemberRow>;
      conversations: Table<ConversationRow>;
      messages: Table<ModerationMessageRow>;
      drafts: Table<DraftRow>;
      faq_entries: Table<FaqEntryRow>;
      faq_categories: Table<FaqCategoryRow>;
      faq_entry_versions: Table<FaqEntryVersionRow>;
      story_mentions: Table<StoryMentionRow>;
      channel_connections: Table<ChannelConnectionRow>;
      moderation_audit_log: Table<ModerationAuditRow>;
      planning_boards: Table<PlanningBoardRow>;
      planning_months: Table<PlanningMonthRow>;
      planning_lanes: Table<PlanningLaneRow>;
      planning_subjects: Table<PlanningSubjectRow>;
      planning_comments: Table<PlanningCommentRow>;
      planning_faq_entries: Table<PlanningFaqEntryRow>;
      planning_columns: Table<PlanningColumnRow>;
      planning_activity: Table<PlanningActivityRow>;
      planning_publications: Table<PlanningPublicationRow>;

      receipt_sources: Table<ReceiptSource>;
      receipt_expenses: Table<ReceiptExpense>;
      receipt_documents: Table<ReceiptDocument>;
      receipt_merchant_rules: Table<ReceiptMerchantRule>;
      receipt_events: Table<ReceiptEvent>;
      finance_accounts: Table<FinanceAccount>;
      finance_balances_history: Table<FinanceBalanceSnapshot>;
      finance_invoices: Table<FinanceInvoice>;
      finance_categories: Table<FinanceCategory>;
      finance_category_rules: Table<FinanceCategoryRule>;
      finance_transactions: Table<FinanceTransaction>;
      finance_ledger_entries: Table<FinanceLedgerEntry>;
      finance_receipts: Table<FinanceReceipt>;
      finance_sync_runs: Table<FinanceSyncRun>;
      finance_merchant_logos: Table<FinanceMerchantLogo>;
      finance_retrieval_sources: Table<FinanceRetrievalSource>;
      billing_engagements: Table<BillingEngagement>;
      billing_installments: Table<BillingInstallment>;
      billing_client_aliases: Table<BillingClientAlias>;
      work_cycles: Table<WorkCycle>;
      work_cycle_steps: Table<WorkCycleStep>;
      work_tasks: Table<WorkTask>;
      client_context: Table<ClientContext>;
      client_assets: Table<ClientAsset>;
      workspace_page_grants: Table<WorkspacePageGrant>;
      client_phases: Table<ClientPhase>;
      client_reports: Table<ClientReport>;
      generation_jobs: Table<GenerationJob>;
      wording_history: Table<WordingHistoryEntry>;
      social_accounts: Table<SocialAccount>;
      social_account_secrets: Table<SocialAccountSecret>;
      workspace_social_accounts: Table<WorkspaceSocialLink>;
      academy_courses: Table<AcademyCourse>;
      academy_modules: Table<AcademyModule>;
      academy_lessons: Table<AcademyLesson>;
      academy_progress: Table<AcademyProgress>;
      academy_notes: Table<AcademyNote>;
      academy_enrollments: Table<AcademyEnrollment>;
    };
    // `never` satisfait la contrainte `Record<string, GenericView>` de
    // postgrest-js tout en déclarant qu'il n'y a ni vue ni fonction exposée.
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      // Socle (0001) — les alias vivent en tête de fichier ; les modules
      // suivants sont en littéraux inline, valeurs dans l'ordre de leur
      // migration puis des `alter type ... add value` qui les étendent.
      workspace_type: WorkspaceType;
      org_role: OrgRole;
      workspace_role: WorkspaceRole;
      invitation_role: InvitationRole;
      data_provider: DataProvider;
      data_source_status: DataSourceStatus;
      sync_status: SyncStatus;
      ad_level: AdLevel;
      breakdown_type: BreakdownType;
      social_platform: SocialPlatform;
      // Modération (0004)
      moderation_channel:
        | "instagram"
        | "facebook"
        | "whatsapp"
        | "tiktok"
        | "linkedin"
        | "youtube"
        | "google_reviews";
      moderation_role: "operator" | "viewer";
      conversation_kind: "dm" | "comment" | "story_mention" | "review";
      conversation_status:
        | "to_process"
        | "awaiting_validation"
        | "validated"
        | "sent"
        | "ignored"
        | "snoozed"
        | "send_failed"
        | "answered_elsewhere";
      conversation_priority: "normal" | "high";
      message_direction: "inbound" | "outbound";
      message_origin: "platform" | "antidotes" | "auto_send";
      draft_status:
        | "proposed"
        | "validated"
        | "refused"
        | "sent"
        | "expired"
        | "no_answer_available";
      ingestion_mode: "webhook" | "polling";
      connection_status: "pending" | "connected" | "error" | "disabled";
      webhook_status: "pending" | "processed" | "failed" | "dead";
      story_mention_status:
        | "new"
        | "reshared"
        | "replied"
        | "ignored"
        | "archived";
      monday_sync_direction: "pull" | "push";
      // Planning (0006, 0009)
      planning_board_kind: "editorial" | "faq";
      planning_platform:
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
      planning_format:
        | "post"
        | "story"
        | "reel"
        | "carousel"
        | "video"
        | "thread"
        | "dark"
        | "other";
      planning_status:
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
      planning_ad_status: "todo" | "doing" | "done" | "blocked";
      planning_comment_scope: "general" | "visual" | "wording";
      planning_column_type:
        | "status"
        | "dropdown"
        | "text"
        | "date"
        | "people"
        | "number"
        | "checkbox";
      // Reçus (0010 ; « archived » ajouté par 0025)
      receipt_provider: "gmail";
      receipt_source_status: "pending" | "connected" | "error" | "disabled";
      receipt_kind:
        | "invoice"
        | "receipt"
        | "subscription"
        | "statement"
        | "other";
      receipt_status:
        | "detected"
        | "awaiting_validation"
        | "queued"
        | "forwarded"
        | "attached"
        | "unmatched"
        | "ignored"
        | "failed"
        | "archived";
      receipt_pdf_origin: "attachment" | "rendered" | "none";
      receipt_match_method: "exact" | "fuzzy" | "manual" | "none";
      // Finance (0012 ; « ledger » ajouté par 0021/0023, « billing » par 0025)
      finance_invoice_status: "draft" | "sent" | "paid" | "void";
      finance_transaction_source:
        | "airwallex"
        | "whatsapp"
        | "manual"
        | "ledger";
      finance_receipt_source: "whatsapp" | "manual" | "email";
      finance_match_status:
        | "none"
        | "auto"
        | "pending"
        | "confirmed"
        | "rejected";
      finance_sync_kind:
        | "balances"
        | "transactions"
        | "invoices"
        | "ledger"
        | "billing";
      // Mon travail (0014)
      work_task_source: "manual" | "fathom" | "email" | "recurring";
      work_task_status: "pending" | "done" | "deleted";
      // Échéances (0016)
      billing_engagement_status: "active" | "ended";
      billing_installment_status: "pending" | "issued" | "paid" | "skipped";
      // Contexte client (0032)
      client_asset_type:
        | "website"
        | "questionnaire"
        | "strategy"
        | "lookbook"
        | "guidelines"
        | "benchmark"
        | "other";
      client_asset_extraction_status: "pending" | "running" | "done" | "error";
      planning_wording_status: "pending" | "generated" | "validated";
      // Production (0032 ; « cancelled » ajouté par 0034)
      production_phase:
        | "intentions"
        | "wording"
        | "programmation"
        | "reporting";
      production_phase_status: "pending" | "in_progress" | "done" | "skipped";
      generation_job_status:
        | "pending"
        | "running"
        | "done"
        | "error"
        | "partial"
        | "cancelled";
      // Comptes sociaux (0043 ; cinq réseaux ajoutés par 0049)
      social_account_kind:
        | "instagram"
        | "facebook_page"
        | "meta_ad_account"
        | "linkedin"
        | "tiktok"
        | "youtube"
        | "pinterest"
        | "x"
        | "threads"
        | "snapchat";
      social_account_status: "connected" | "expired" | "error" | "disabled";
      // Publication automatique du Planning (0046)
      publish_target: "instagram" | "facebook";
      publish_run_status: "running" | "success" | "error";
      // Reporting Site Web (0060)
      web_breakdown_type: WebBreakdownType;
      // FAQ (20260830)
      faq_client_review: "pending" | "approved" | "rejected";
      // Academy (20260830a)
      academy_video_provider: AcademyVideoProvider;
      academy_progress_status: AcademyProgressStatus;
      // Academy — inscriptions (20260903a)
      academy_enrollment_status: AcademyEnrollmentStatus;
    };
    CompositeTypes: Record<never, never>;
  };
}
