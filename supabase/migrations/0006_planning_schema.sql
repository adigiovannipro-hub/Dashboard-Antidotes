-- ===========================================================================
-- Planning Éditorial — schéma
--
-- Le planning éditorial social media, tenu jusqu'ici dans Monday.com, vit
-- désormais dans l'espace du client, à côté de son Reporting.
--
-- La hiérarchie reproduit celle des boards PE :
--
--   tableau (une année)  →  mois  →  réseau social  →  publication
--
-- Un espace porte plusieurs tableaux : une année de planning éditorial, et un
-- tableau FAQ séparé qu'alimente le module Modération. Les deux vivent côte à
-- côte dans la même section, sans rien partager d'autre que l'espace.
--
-- Tout est rattaché à `workspace_id` : l'isolation entre clients est celle,
-- déjà éprouvée, des espaces. Un client édite son propre planning — c'est le
-- modèle de rôles acté pour la plateforme, où aucun utilisateur authentifié
-- n'est en lecture seule.
-- ===========================================================================

-- Reprise en cas de réapplication : le module a changé de forme entre deux
-- itérations de la branche, et l'ancien schéma n'a aucune donnée à préserver.
drop table if exists planning_sync_runs cascade;
drop table if exists planning_subjects cascade;
drop table if exists planning_lanes cascade;
drop table if exists planning_months cascade;
drop table if exists planning_boards cascade;
drop table if exists planning_members cascade;
drop table if exists planning_clients cascade;
drop type if exists planning_role cascade;
drop type if exists planning_sync_direction cascade;

-- --- Types -----------------------------------------------------------------

create type planning_board_kind as enum ('editorial', 'faq');

create type planning_platform as enum (
  'meta', 'instagram', 'facebook', 'linkedin', 'tiktok',
  'youtube', 'x', 'pinterest', 'snapchat', 'other'
);

create type planning_format as enum (
  'post', 'story', 'reel', 'carousel', 'video', 'thread', 'dark', 'other'
);

-- Les neuf libellés du board, plus `idea` pour une ligne sans statut — l'état
-- d'une publication qu'on vient de créer et qui n'a encore rien.
create type planning_status as enum (
  'idea',          -- (aucun statut)
  'dropped',       -- NON RETENU
  'on_hold',       -- EN ATTENTE
  'in_progress',   -- EN COURS
  'wording_todo',  -- WORDING À FAIRE
  'to_validate',   -- À VALIDER
  'validated',     -- VALIDÉ
  'draft',         -- EN BROUILLON
  'scheduled',     -- PROGRAMMÉ
  'published'      -- PUBLIÉ
);

create type planning_ad_status as enum ('todo', 'doing', 'done', 'blocked');

-- Un retour client porte sur le visuel ou sur le wording : les deux sujets de
-- discussion d'une validation, et ils n'appellent pas la même correction.
create type planning_comment_scope as enum ('general', 'visual', 'wording');

-- --- Tableaux ---------------------------------------------------------------

create table planning_boards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  kind planning_board_kind not null default 'editorial',
  slug text not null,
  name text not null,
  -- L'année du planning. `null` pour un tableau FAQ, qui n'en a pas.
  year integer,
  position integer not null default 0,
  /* Vocabulaire propre au tableau : objectifs publicitaires proposés dans le
     sélecteur. Une donnée, pas du code — chaque client a les siens. */
  settings jsonb not null default '{
    "ad_objectives": ["Engagement", "Vues vidéos", "Couverture", "Traffic",
                      "Conversion", "Visite de profil", "Followers"]
  }'::jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create index planning_boards_workspace_idx
  on planning_boards (workspace_id, position);

-- --- Mois --------------------------------------------------------------------

create table planning_months (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references planning_boards (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  -- Libellé affiché (« SEPTEMBRE »), librement modifiable.
  label text not null,
  -- Premier jour du mois. C'est cette colonne qui trie et qui compare ;
  -- « SEPTEMBRE » ne se trie pas.
  month date not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (board_id, month)
);

create index planning_months_board_idx on planning_months (board_id, position);

-- --- Réseaux sociaux ---------------------------------------------------------

-- Un couloir par réseau et par mois. Pas de contrainte d'unicité sur le couple
-- (mois, plateforme) : un même mois porte parfois deux couloirs Meta, l'un pour
-- le feed et l'autre pour le dark, et c'est un usage légitime.
create table planning_lanes (
  id uuid primary key default gen_random_uuid(),
  month_id uuid not null references planning_months (id) on delete cascade,
  board_id uuid not null references planning_boards (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  platform planning_platform not null default 'meta',
  name text not null,
  position integer not null default 0,
  /* Identifiant de l'élément Monday d'origine, quand le couloir vient d'un
     import. Il rend l'import rejouable : une seconde passe met à jour au lieu
     de dupliquer. `null` pour tout ce qui est créé ici. */
  external_id text,
  created_at timestamptz not null default now(),
  unique (board_id, external_id)
);

create index planning_lanes_month_idx on planning_lanes (month_id, position);

-- --- Publications ------------------------------------------------------------

create table planning_subjects (
  id uuid primary key default gen_random_uuid(),
  lane_id uuid not null references planning_lanes (id) on delete cascade,
  month_id uuid not null references planning_months (id) on delete cascade,
  board_id uuid not null references planning_boards (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  -- Le sujet de la publication. Vide à la création : on tape directement dans
  -- la cellule, comme dans un tableur.
  name text not null default '',
  status planning_status not null default 'idea',
  format planning_format not null default 'post',
  scheduled_on date,
  -- La caption. Intention en phase de planning, texte publiable ensuite.
  wording text,
  sponsoring numeric(12, 2),
  -- Texte libre validé contre `settings.ad_objectives` du tableau.
  ad_objective text,
  ad_status planning_ad_status,
  owner_id uuid references profiles (id) on delete set null,
  visual_urls text[] not null default '{}',
  position integer not null default 0,
  /* Voir `planning_lanes.external_id` : même rôle, même raison. */
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board_id, external_id)
);

-- La vue mensuelle lit par couloir ; le contrôle de cadence balaie l'espace
-- entier par date.
create index planning_subjects_lane_idx on planning_subjects (lane_id, position);
create index planning_subjects_schedule_idx
  on planning_subjects (workspace_id, scheduled_on);
create index planning_subjects_board_idx on planning_subjects (board_id, month_id);

-- --- Retours client ----------------------------------------------------------

-- La colonne « + » de chaque ligne : le fil de discussion entre l'agence et le
-- client sur une publication précise.
create table planning_comments (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references planning_subjects (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  author_id uuid references profiles (id) on delete set null,
  scope planning_comment_scope not null default 'general',
  body text not null,
  created_at timestamptz not null default now()
);

create index planning_comments_subject_idx
  on planning_comments (subject_id, created_at);

-- --- FAQ ---------------------------------------------------------------------

-- Le second tableau. Le module Modération l'enrichit à chaque correction, mais
-- rien de la Modération n'apparaît ici : le client voit la FAQ, pas la boîte de
-- réception qui l'alimente.
create table planning_faq_entries (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references planning_boards (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  question text not null default '',
  answer text,
  category text,
  position integer not null default 0,
  -- `moderation` pour une entrée créée par la boucle de correction, `manual`
  -- pour une saisie directe. Utile pour savoir ce qui vient d'où.
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index planning_faq_board_idx on planning_faq_entries (board_id, position);

-- --- Horodatage ---------------------------------------------------------------

create or replace function app.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger planning_subjects_touch
  before update on planning_subjects
  for each row execute function app.touch_updated_at();

create trigger planning_faq_touch
  before update on planning_faq_entries
  for each row execute function app.touch_updated_at();
