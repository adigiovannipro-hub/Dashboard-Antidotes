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
  | "tiktok_organic";
export type DataSourceStatus = "pending" | "connected" | "error" | "disabled";
export type SyncStatus = "running" | "success" | "error";
export type AdLevel = "campaign" | "adset" | "ad";
export type BreakdownType = "age" | "gender" | "region";
export type SocialPlatform = "instagram" | "facebook" | "tiktok";

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
  invited_by: string | null;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
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

export type AdMetricsDaily = {
  data_source_id: string;
  workspace_id: string;
  entity_id: string;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  link_clicks: number;
  purchases: number;
  purchase_value: number;
  landing_page_views: number;
  comments: number;
  saves: number;
  shares: number;
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
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  updated_at: string;
}

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
  question_canonical: string;
  variants: string[];
  answer_fr: string | null;
  answer_en: string | null;
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
  position: number;
  external_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PlanningCommentRow = {
  id: string;
  subject_id: string;
  workspace_id: string;
  author_id: string | null;
  scope: string;
  body: string;
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
      social_followers: Table<SocialFollowers>;
      social_posts: Table<SocialPost>;
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
      billing_engagements: Table<BillingEngagement>;
      billing_installments: Table<BillingInstallment>;
      billing_client_aliases: Table<BillingClientAlias>;
      work_cycles: Table<WorkCycle>;
      work_cycle_steps: Table<WorkCycleStep>;
      work_tasks: Table<WorkTask>;
    };
    // `never` satisfait la contrainte `Record<string, GenericView>` de
    // postgrest-js tout en déclarant qu'il n'y a ni vue ni fonction exposée.
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
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
    };
    CompositeTypes: Record<never, never>;
  };
}
