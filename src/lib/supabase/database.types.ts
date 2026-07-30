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

export interface Workspace {
  id: string;
  org_id: string;
  type: WorkspaceType;
  slug: string;
  name: string;
  logo_url: string | null;
  accent_color: string | null;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface Membership {
  user_id: string;
  workspace_id: string;
  role: WorkspaceRole;
  created_at: string;
}

export interface OrganizationMember {
  org_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
}

export interface Invitation {
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

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface DataSource {
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

export interface SyncRun {
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

export interface AdEntity {
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

export interface AdMetricsDaily {
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

export interface AdBreakdownDaily {
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

export interface SocialFollowers {
  data_source_id: string;
  workspace_id: string;
  platform: SocialPlatform;
  date: string;
  followers_count: number;
  source: string;
  updated_at: string;
}

export interface SocialPost {
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

export interface Dashboard {
  id: string;
  workspace_id: string;
  slug: string;
  name: string;
  layout: Record<string, unknown>;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ShareLink {
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

export interface AuditLogEntry {
  id: number;
  actor_id: string | null;
  org_id: string | null;
  workspace_id: string | null;
  action: string;
  target: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
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
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
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
