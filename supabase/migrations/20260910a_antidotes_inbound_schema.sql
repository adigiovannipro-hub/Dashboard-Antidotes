-- ===========================================================================
-- Pôle « Antidotes », phase 4 — l'inbound : schéma
--
-- Le corpus (`antidotes_reference_posts`) et les posts générés existent
-- depuis 20260907a. Cette migration pose ce qui manquait pour que le radar,
-- le studio et la bibliothèque tournent :
--
--   • `antidotes_radar_accounts` — la liste des comptes qu'on veille, par
--     réseau, avec le nombre d'abonnés qui sert de dénominateur au score
--     d'engagement relatif. Un compte se relève, se met en pause, garde sa
--     dernière erreur.
--   • `antidotes_radar_topics` — les sujets que le modèle propose à partir
--     des posts qui marchent : un titre, un angle, les posts qui l'appuient.
--     Stockés, parce qu'un sujet se garde pour la semaine prochaine et qu'on
--     ne repaie pas l'appel à chaque ouverture de l'écran.
--   • sur le corpus : le compte d'origine, la date de publication (la
--     veille se lit par période), la source de l'embedding — deux sources ne
--     se comparent pas.
--   • sur un post généré : le sujet d'origine, le brief saisi, les cinq
--     exemples du corpus injectés dans le prompt (on doit pouvoir dire
--     pourquoi le post sonne comme il sonne), le prompt du visuel, l'URL
--     publiée, la dernière erreur.
-- ===========================================================================

-- --- Types -----------------------------------------------------------------

/* Un sujet proposé attend, sert à un post, ou est écarté. Écarté n'est pas
   supprimé : reproposer le même sujet la semaine suivante serait agaçant. */
create type antidotes_topic_status as enum ('new', 'used', 'dismissed');

-- --- Les comptes veillés -------------------------------------------------------

create table antidotes_radar_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  platform antidotes_post_platform not null,
  -- Sans arobase ni URL : `sandrodigiovanni`, `@` retiré à la saisie.
  handle text not null,
  url text,
  label text,
  -- Le dénominateur du score relatif. Saisi ou relevé par le connecteur quand
  -- le réseau le rend ; sans lui, le score se calcule en absolu et le dit.
  followers integer,
  is_active boolean not null default true,
  last_collected_at timestamptz,
  last_error text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint antidotes_radar_accounts_handle_not_empty check (length(trim(handle)) > 0),
  unique (org_id, platform, handle)
);

create index antidotes_radar_accounts_org_idx
  on antidotes_radar_accounts (org_id, is_active);

create trigger antidotes_radar_accounts_touch
  before update on antidotes_radar_accounts
  for each row execute function app.touch_updated_at();

-- --- Le corpus : d'où vient un post, quand il est paru -------------------------

alter table antidotes_reference_posts
  add column if not exists account_id uuid references antidotes_radar_accounts (id) on delete set null,
  add column if not exists published_at timestamptz,
  -- `openai` (text-embedding-3-small, 1536 d) ; nul tant que rien n'est calculé.
  add column if not exists embedding_source text;

create index if not exists antidotes_reference_posts_published_idx
  on antidotes_reference_posts (org_id, published_at desc);

/* L'index d'unicité par URL de 20260907a était **partiel** (`where url is
   not null`), et un `on conflict (org_id, url)` ne sait pas s'y adosser :
   PostgREST ne transmet pas le prédicat, Postgres répond « no unique or
   exclusion constraint matching the ON CONFLICT specification » — payé au
   premier import de l'export LinkedIn. Un index plein fait la même chose :
   deux URL nulles ne sont jamais égales, les posts collés sans lien restent
   libres, et le rangement du radar par URL a enfin son point d'appui. */
drop index if exists antidotes_reference_posts_url_idx;
create unique index antidotes_reference_posts_url_idx
  on antidotes_reference_posts (org_id, url);

-- --- Les sujets proposés -------------------------------------------------------

create table antidotes_radar_topics (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  title text not null,
  angle text,
  -- [{post_id, why}] : les posts qui appuient le sujet, et en quoi.
  evidence jsonb not null default '[]'::jsonb,
  score numeric(8, 2),
  status antidotes_topic_status not null default 'new',
  created_at timestamptz not null default now()
);

create index antidotes_radar_topics_org_idx
  on antidotes_radar_topics (org_id, status, created_at desc);

-- --- Les posts générés : traçabilité et publication ---------------------------

alter table antidotes_generated_posts
  add column if not exists topic_id uuid references antidotes_radar_topics (id) on delete set null,
  add column if not exists brief text,
  -- [{post_id, similarity}] : les exemples du corpus injectés dans le prompt.
  add column if not exists examples jsonb not null default '[]'::jsonb,
  add column if not exists image_prompt text,
  add column if not exists published_url text,
  add column if not exists error text;
