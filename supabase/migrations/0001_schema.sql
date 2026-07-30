-- ===========================================================================
-- Antidotes — schéma initial
--
-- Deux niveaux d'appartenance :
--   • `organization_members` : le rôle `owner` porte sur TOUTE l'organisation
--     et donne accès à l'ensemble des espaces, y compris `personal`.
--   • `memberships` : rattache un contributeur interne ou un client à un
--     espace précis. Ces rôles n'atteignent jamais l'espace `personal`.
--
-- Les tables de données portent toutes une colonne `workspace_id`
-- dénormalisée : les politiques RLS n'ont ainsi jamais besoin de jointure,
-- ce qui les rend à la fois plus lisibles et bien plus rapides.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- Schéma privé réservé aux fonctions utilitaires de sécurité. Aucun accès
-- direct : il n'est pas exposé par PostgREST.
create schema if not exists app;
revoke all on schema app from public, anon, authenticated;

-- --- Types -----------------------------------------------------------------

create type workspace_type as enum ('personal', 'business', 'client');
create type org_role as enum ('owner', 'member');
create type workspace_role as enum ('contributor', 'client');
create type invitation_role as enum ('owner', 'contributor', 'client');
create type data_provider as enum ('meta_ads', 'meta_organic', 'tiktok_ads', 'tiktok_organic');
create type data_source_status as enum ('pending', 'connected', 'error', 'disabled');
create type sync_status as enum ('running', 'success', 'error');
create type ad_level as enum ('campaign', 'adset', 'ad');
create type breakdown_type as enum ('age', 'gender', 'region');
create type social_platform as enum ('instagram', 'facebook', 'tiktok');

-- --- Profils ---------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- --- Organisation et espaces ----------------------------------------------

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table organization_members (
  org_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role org_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  type workspace_type not null,
  slug text not null,
  name text not null,
  logo_url text,
  -- Couleur d'accent, permet de rebrander l'espace d'un client sans toucher
  -- au code : elle alimente les tokens CSS au rendu.
  accent_color text,
  created_at timestamptz not null default now(),
  unique (org_id, slug)
);

create table memberships (
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  role workspace_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, workspace_id)
);

create index memberships_workspace_idx on memberships (workspace_id);

create table invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  org_id uuid not null references organizations (id) on delete cascade,
  -- `null` pour une invitation `owner`, qui porte sur l'organisation entière.
  workspace_id uuid references workspaces (id) on delete cascade,
  role invitation_role not null,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  accepted_at timestamptz,
  constraint invitation_scope check (
    (role = 'owner' and workspace_id is null)
    or (role <> 'owner' and workspace_id is not null)
  )
);

create index invitations_email_idx on invitations (lower(email)) where accepted_at is null;

-- --- Sources de données ----------------------------------------------------

create table data_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  provider data_provider not null,
  -- Identifiant côté régie : `act_123…` pour Meta Ads, ID de page ou de compte
  -- IG pour l'organique.
  external_account_id text not null,
  display_name text,
  -- Token chiffré en AES-256-GCM côté application. La base ne voit qu'un blob :
  -- même une fuite de dump ne livre pas les accès aux comptes clients.
  credentials_encrypted text,
  status data_source_status not null default 'pending',
  -- Date de départ du backfill initial.
  backfill_from date,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (workspace_id, provider, external_account_id)
);

create table sync_runs (
  id uuid primary key default gen_random_uuid(),
  data_source_id uuid not null references data_sources (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  status sync_status not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  date_from date,
  date_to date,
  rows_ingested integer not null default 0,
  error text
);

create index sync_runs_source_idx on sync_runs (data_source_id, started_at desc);

-- --- Données publicitaires -------------------------------------------------

create table ad_entities (
  id uuid primary key default gen_random_uuid(),
  data_source_id uuid not null references data_sources (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  level ad_level not null,
  external_id text not null,
  parent_external_id text,
  name text not null,
  status text,
  thumbnail_url text,
  permalink text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (data_source_id, external_id)
);

create index ad_entities_parent_idx on ad_entities (data_source_id, parent_external_id);

-- Grain : jour × entité. Seules des grandeurs additives sont stockées ; tous
-- les ratios (CPA, CPM, ROAS, CTR, CPC, CPL) sont recalculés à la lecture,
-- depuis les sommes de la période affichée. Voir src/lib/metrics/.
create table ad_metrics_daily (
  data_source_id uuid not null references data_sources (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  entity_id uuid not null references ad_entities (id) on delete cascade,
  date date not null,
  spend numeric(14, 4) not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  link_clicks bigint not null default 0,
  purchases bigint not null default 0,
  purchase_value numeric(14, 4) not null default 0,
  landing_page_views bigint not null default 0,
  comments bigint not null default 0,
  saves bigint not null default 0,
  shares bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (entity_id, date)
);

create index ad_metrics_daily_workspace_date_idx
  on ad_metrics_daily (workspace_id, date);

-- Alimente les trois donuts du bloc « Persona ». La source est bien le
-- breakdown Meta Ads Insights (age / gender / region), et non la démographie
-- Instagram : c'est ce que confirment les catégories « unknown » du rapport.
create table ad_breakdowns_daily (
  data_source_id uuid not null references data_sources (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  date date not null,
  type breakdown_type not null,
  value text not null,
  spend numeric(14, 4) not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (data_source_id, date, type, value)
);

create index ad_breakdowns_workspace_idx
  on ad_breakdowns_daily (workspace_id, type, date);

-- --- Données organiques ----------------------------------------------------

-- Meta n'expose l'historique des abonnés que sur ~30 jours glissants : cette
-- table est notre seule mémoire longue. Les valeurs antérieures au premier
-- sync sont importables en CSV (`source = 'csv_import'`).
create table social_followers (
  data_source_id uuid not null references data_sources (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  platform social_platform not null,
  date date not null,
  followers_count integer not null,
  source text not null default 'api',
  updated_at timestamptz not null default now(),
  primary key (data_source_id, platform, date)
);

create index social_followers_workspace_idx
  on social_followers (workspace_id, date);

create table social_posts (
  id uuid primary key default gen_random_uuid(),
  data_source_id uuid not null references data_sources (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  platform social_platform not null,
  external_id text not null,
  published_at timestamptz not null,
  caption text,
  permalink text,
  thumbnail_url text,
  reach bigint not null default 0,
  impressions bigint not null default 0,
  likes bigint not null default 0,
  comments bigint not null default 0,
  saves bigint not null default 0,
  shares bigint not null default 0,
  updated_at timestamptz not null default now(),
  unique (data_source_id, external_id)
);

create index social_posts_workspace_idx
  on social_posts (workspace_id, published_at desc);

-- --- Dashboards et partage -------------------------------------------------

create table dashboards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  slug text not null,
  name text not null,
  -- Disposition et configuration des widgets, éditables par tous les rôles
  -- ayant accès à l'espace.
  layout jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create table share_links (
  id uuid primary key default gen_random_uuid(),
  dashboard_id uuid not null references dashboards (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  token text not null unique,
  password_hash text,
  -- `rolling` : la période suit la date du jour. `fixed` : période figée,
  -- pour envoyer un rapport mensuel qui ne bougera plus.
  date_mode text not null default 'rolling',
  date_from date,
  date_to date,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index share_links_dashboard_idx on share_links (dashboard_id);

create table audit_log (
  id bigserial primary key,
  actor_id uuid references auth.users (id) on delete set null,
  org_id uuid references organizations (id) on delete cascade,
  workspace_id uuid references workspaces (id) on delete cascade,
  action text not null,
  target text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_created_idx on audit_log (created_at desc);

-- --- Inscription et acceptation des invitations ----------------------------

-- Un compte créé par magic link n'a, en soi, accès à rien. C'est uniquement la
-- présence d'une invitation à son adresse qui lui ouvre des espaces. Un email
-- non invité se retrouve donc avec zéro workspace visible.
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into organization_members (org_id, user_id, role)
  select i.org_id, new.id, 'owner'::org_role
  from invitations i
  where lower(i.email) = lower(new.email)
    and i.role = 'owner'
    and i.accepted_at is null
    and i.expires_at > now()
  on conflict (org_id, user_id) do update set role = 'owner';

  insert into memberships (user_id, workspace_id, role)
  select new.id, i.workspace_id, i.role::text::workspace_role
  from invitations i
  where lower(i.email) = lower(new.email)
    and i.role <> 'owner'
    and i.accepted_at is null
    and i.expires_at > now()
  on conflict (user_id, workspace_id) do update set role = excluded.role;

  update invitations
  set accepted_at = now()
  where lower(email) = lower(new.email)
    and accepted_at is null
    and expires_at > now();

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();
