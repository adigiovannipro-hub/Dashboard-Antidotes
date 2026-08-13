-- ===========================================================================
-- Comptes sociaux branchés à un espace client
--
-- Une ligne = un compte publiable ou lisible d'un client : le compte
-- Instagram Professionnel, la Page Facebook qui lui est rattachée, et — le
-- même branchement Meta les donnant ensemble — le compte publicitaire, qui
-- fera la jonction avec le Reporting.
--
-- La table est **par espace** (`workspace_id`) et non par organisation : c'est
-- le client qui possède son compte, et le cloisonnement doit tomber du même
-- côté que le planning qu'elle sert.
-- ===========================================================================

create type social_account_kind as enum (
  'instagram',        -- compte Instagram Professionnel (publication + feed)
  'facebook_page',    -- Page Facebook (publication)
  'meta_ad_account',  -- compte publicitaire Meta (reporting)
  'linkedin',
  'tiktok'
);

create type social_account_status as enum (
  'connected',
  'expired',   -- jeton périmé : reconnexion nécessaire
  'error',
  'disabled'
);

create table social_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  kind social_account_kind not null,

  /* Identifiant chez la plateforme : `ig-user-id`, `page-id`, `act_…`. */
  external_id text not null,
  /* Ce qu'on affiche : `@bondet.optique`, « Bondet Opticien ». */
  username text,
  display_name text,

  /* Vitrine du compte, rafraîchie au branchement puis à chaque sync : elle
     sert l'en-tête de la prévisualisation du feed. Aucune capture d'écran,
     rien de scrappé — ce sont les champs que l'API rend pour un compte dont
     on a l'autorisation. */
  avatar_url text,
  biography text,
  followers_count integer,
  media_count integer,

  /* Jeton chiffré (`CREDENTIALS_ENCRYPTION_KEY`), jamais en clair. Un jeton
     d'utilisateur système Meta n'expire pas ; la colonne reste pour les
     plateformes qui feront autrement. */
  credentials_encrypted text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',

  /* Le compte parent, quand il y en a un : une Page pour un compte
     Instagram. Permet de retrouver le jeton de Page au moment de publier. */
  parent_external_id text,

  status social_account_status not null default 'connected',
  last_error text,
  last_synced_at timestamptz,
  connected_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  /* Un même compte ne se branche qu'une fois par espace. Deux espaces
     peuvent en revanche partager un compte : une marque, deux plannings. */
  unique (workspace_id, kind, external_id)
);

create index social_accounts_workspace_idx
  on social_accounts (workspace_id, kind);

-- --- RLS --------------------------------------------------------------------

alter table social_accounts enable row level security;

revoke all on social_accounts from anon;

-- Lecture ouverte à l'espace : le client voit que son compte est branché, et
-- la prévisualisation du feed a besoin de la vitrine du profil.
create policy social_accounts_select on social_accounts
  for select to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()));

-- Écriture réservée à l'agence : brancher un compte engage un jeton, ce n'est
-- pas un réglage d'affichage.
create policy social_accounts_write on social_accounts
  for all to authenticated
  using (app.owns_workspace(workspace_id))
  with check (app.owns_workspace(workspace_id));
