-- ===========================================================================
-- Module Planning Édito — schéma
--
-- Miroir local des boards Monday.com « PE » (Planning Éditorial) : un board par
-- client et par année, un groupe par mois, un élément parent par plateforme, un
-- sous-élément par contenu.
--
-- Trois principes structurants :
--   • Monday reste la source ; la base est le miroir. Le module lit la base,
--     jamais l'API en direct — même raison que pour les régies publicitaires.
--   • L'écriture est asymétrique : on recopie tout depuis Monday, on n'y
--     réécrit que le Wording et les Commentaires. `Status`, `Visuel`,
--     `Propriétaire`, `Date`, `Thématique` et `OK client` ne sont jamais
--     touchés — c'est la règle des skills éditoriales.
--   • Le mapping des colonnes est une donnée, jamais du code : deux boards
--     clients divergent déjà (colonne `Commentaires` absente chez l'un,
--     libellés de `Thématique` et d'`Objectifs` différents, « AOUT » contre
--     « AOÛT »).
-- ===========================================================================

-- --- Types -----------------------------------------------------------------

create type planning_role as enum ('editor', 'viewer');

-- Plateformes portées par les éléments parents. `dark` n'est pas un réseau mais
-- Monday l'utilise comme couloir à part pour les campagnes non publiées sur le
-- feed : le conserver tel quel évite de le confondre avec de l'organique.
create type planning_platform as enum (
  'meta', 'instagram', 'facebook', 'linkedin',
  'tiktok', 'youtube', 'x', 'dark', 'other'
);

create type planning_format as enum (
  'reel', 'post', 'story', 'carousel', 'thread', 'video', 'dark', 'other'
);

-- Statuts canoniques. Les libellés Monday sont normalisés vers cette échelle à
-- l'ingestion, et le libellé d'origine est conservé à côté : un client qui
-- renomme un statut ne casse rien, et l'interface peut toujours afficher son
-- vocabulaire.
create type planning_status as enum (
  'idea',          -- créé, rien de plus
  'wording_todo',  -- « WORDING À FAIRE »
  'draft',         -- « EN BROUILLON »
  'in_progress',   -- « EN COURS »
  'to_validate',   -- « À VALIDER »
  'validated',     -- « VALIDÉ »
  'scheduled',     -- « PROGRAMMÉ »
  'published',     -- « PUBLIÉ »
  'on_hold',       -- « EN ATTENTE »
  'dropped'        -- « NON RETENU »
);

create type planning_sync_direction as enum ('pull', 'push');

-- --- Clients du module et accès -------------------------------------------

create table planning_clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  -- Rattachement optionnel à un espace de reporting : un client peut avoir un
  -- planning éditorial sans dashboard de performance, et l'inverse.
  workspace_id uuid references workspaces (id) on delete set null,
  slug text not null,
  name text not null,
  /* Stratégie déclarée. `null` — le cas courant — signifie « déduire de
     l'historique », ce que fait `src/lib/planning/strategy.ts`. Renseignée,
     elle prime sur la déduction. */
  strategy_override jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, slug)
);

-- Un `owner` d'organisation accède à tous les clients sans ligne ici.
create table planning_members (
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references planning_clients (id) on delete cascade,
  role planning_role not null default 'editor',
  created_at timestamptz not null default now(),
  primary key (user_id, client_id)
);

create index planning_members_client_idx on planning_members (client_id);

-- --- Boards ----------------------------------------------------------------

create table planning_boards (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references planning_clients (id) on delete cascade,
  monday_board_id text not null,
  -- Les sous-éléments Monday vivent sur un board distinct, dont l'id est
  -- nécessaire pour écrire une valeur de colonne.
  monday_subitem_board_id text,
  name text not null,
  year integer,
  url text,
  -- Les boards « [ARCHIVE] » alimentent la déduction de stratégie mais ne
  -- s'affichent pas dans la navigation.
  is_archive boolean not null default false,
  /* Champ canonique → id de colonne Monday. Déduit à la découverte, corrigeable
     à la main. Voir DEFAULT_COLUMN_MAPPING dans le domaine. */
  column_mapping jsonb not null default '{}'::jsonb,
  /* Libellé Monday → statut canonique, pour les clients qui ont renommé leurs
     statuts. Vide = on applique la normalisation par défaut. */
  status_mapping jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (client_id, monday_board_id)
);

create index planning_boards_client_idx on planning_boards (client_id, year desc);

-- --- Mois, couloirs, sujets ------------------------------------------------

create table planning_months (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references planning_boards (id) on delete cascade,
  client_id uuid not null references planning_clients (id) on delete cascade,
  monday_group_id text not null,
  -- Libellé d'origine du groupe (« AOUT », « AOÛT », « JUIN »).
  label text not null,
  -- Premier jour du mois. C'est cette colonne qui rend l'ordre et les
  -- comparaisons possibles : « AOUT » ne se trie pas.
  month date not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (board_id, monday_group_id)
);

create index planning_months_client_idx on planning_months (client_id, month desc);

create table planning_lanes (
  id uuid primary key default gen_random_uuid(),
  month_id uuid not null references planning_months (id) on delete cascade,
  client_id uuid not null references planning_clients (id) on delete cascade,
  monday_item_id text not null unique,
  platform planning_platform not null default 'other',
  -- Nom d'origine de l'élément parent (« META », « LINKEDIN », « DARK »).
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index planning_lanes_month_idx on planning_lanes (month_id, position);

create table planning_subjects (
  id uuid primary key default gen_random_uuid(),
  lane_id uuid not null references planning_lanes (id) on delete cascade,
  month_id uuid not null references planning_months (id) on delete cascade,
  client_id uuid not null references planning_clients (id) on delete cascade,
  monday_item_id text not null unique,
  name text not null,
  format planning_format not null default 'other',
  -- Libellé d'origine de la Thématique, conservé pour l'affichage.
  format_raw text,
  scheduled_on date,
  status planning_status not null default 'idea',
  status_raw text,
  /* Colonne Wording : intention en phase de planning, caption finale en phase
     de rédaction. La caption écrase l'intention — c'est voulu. */
  wording text,
  comments text,
  sponsoring numeric(12, 2),
  objective text,
  owner_name text,
  visual_urls text[] not null default '{}',
  permalink text,
  /* File d'attente du push. Une modification de wording est enregistrée ici et
     n'atteint Monday que sur action explicite : le push est sous revue, jamais
     automatique. */
  pending_wording text,
  pending_since timestamptz,
  pushed_at timestamptz,
  monday_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- La vue mensuelle, les compteurs de production et l'analyse de cadence — qui
-- balaie plusieurs mois — tapent sur ces trois index.
create index planning_subjects_month_idx
  on planning_subjects (client_id, month_id, scheduled_on);
create index planning_subjects_status_idx
  on planning_subjects (client_id, status);
create index planning_subjects_schedule_idx
  on planning_subjects (client_id, scheduled_on);
-- Les sujets en attente de push : quelques lignes, consultées à chaque rendu.
create index planning_subjects_pending_idx
  on planning_subjects (client_id, pending_since)
  where pending_wording is not null;

-- --- Journal des synchronisations ------------------------------------------

create table planning_sync_runs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references planning_clients (id) on delete cascade,
  board_id uuid references planning_boards (id) on delete set null,
  direction planning_sync_direction not null default 'pull',
  status sync_status not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  boards_seen integer not null default 0,
  subjects_upserted integer not null default 0,
  error text
);

create index planning_sync_runs_client_idx
  on planning_sync_runs (client_id, started_at desc);
