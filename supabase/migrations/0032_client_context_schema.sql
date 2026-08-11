-- ===========================================================================
-- Contexte client — schéma
--
-- La page « Contexte » d'un espace client, réservée à l'owner de
-- l'organisation : la source de vérité qui alimente toutes les générations IA
-- du dashboard (intentions, wordings, textes de créa, reporting).
--
--   • `client_context`   le brief éditorial, versionné. Une seule version
--                        active par espace ; régénérer crée une version + 1
--                        et désactive l'ancienne, rien n'est jamais écrasé.
--   • `client_assets`    les documents de référence déposés (site, brief,
--                        stratégie, lookbook…), leur résumé extrait par le
--                        modèle, et la case qui décide de leur injection
--                        dans les prompts.
--   • `wording_history`  les accroches déjà publiées, pour que la génération
--                        ne se répète jamais. Alimentée à la validation d'un
--                        wording, lue par `getClientContext()`.
--
-- Le tenant est `workspace_id`, comme pour le Planning : « client » au sens
-- produit = espace client au sens du socle. Il n'existe pas de table
-- `clients` distincte.
--
-- Tout est en `if not exists` : une branche parallèle (cartes client /
-- phases) réserve les mêmes tables `wording_history` & co, et le merge ne
-- doit pas casser sur « existe déjà ».
-- ===========================================================================

-- --- Types -----------------------------------------------------------------

-- Guards `duplicate_object` plutôt que `create type` nu : voir l'en-tête.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'client_asset_type') then
    create type client_asset_type as enum (
      'website',        -- export du site de la marque
      'questionnaire',  -- questionnaire d'onboarding rempli par le client
      'strategy',       -- document de stratégie social media
      'lookbook',       -- lookbook, planches visuelles
      'guidelines',     -- charte graphique ou éditoriale
      'benchmark',      -- analyse concurrentielle
      'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'client_asset_extraction_status') then
    create type client_asset_extraction_status as enum (
      'pending', 'running', 'done', 'error'
    );
  end if;

  -- Étape de génération du wording d'une publication du planning :
  -- rien de généré → généré par l'IA → validé (et l'accroche part alors
  -- dans `wording_history`).
  if not exists (select 1 from pg_type where typname = 'planning_wording_status') then
    create type planning_wording_status as enum ('pending', 'generated', 'validated');
  end if;
end
$$;

-- --- Brief éditorial versionné ----------------------------------------------

create table if not exists client_context (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  version integer not null default 1,
  is_active boolean not null default true,

  /* Le socle : qui est la marque, ce qu'elle vend, à quel prix, avec quel
     héritage, dans quel marché. Le champ le plus long. */
  main_context text,
  positioning text,
  audience text,
  tone_of_voice text,
  /* Les piliers de contenu — le champ le plus important pour la génération.
     Tableau d'objets { nom, description, formats, angles, frequence } : les
     clés restent en français, ce sont des données produit injectées telles
     quelles dans les prompts. */
  pillars jsonb not null default '[]'::jsonb,
  mentions text,
  /* Les interdits du client. Contraignants : les prompts de génération les
     reportent tels quels, jamais adoucis. */
  restrictions text,
  /* Règles par réseau : { "instagram": "...", "linkedin": "..." } — format
     d'écriture, longueur, emojis, hashtags, tutoiement, mentions. */
  platforms jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,

  unique (workspace_id, version)
);

-- Une seule version active par espace : c'est l'index, pas l'application,
-- qui garantit qu'une régénération ne laisse jamais deux briefs actifs.
create unique index if not exists client_context_one_active_idx
  on client_context (workspace_id) where is_active;

create index if not exists client_context_workspace_idx
  on client_context (workspace_id, version desc);

-- --- Documents de référence --------------------------------------------------

create table if not exists client_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  name text not null,
  type client_asset_type not null,
  /* Chemin dans le bucket `client-assets`, premier segment = workspace_id —
     même convention lisible que `planning-visuals`. */
  storage_path text not null,
  mime_type text,
  size_bytes bigint,

  /* Le résumé éditorial extrait par le modèle — c'est lui, jamais le document
     brut, qui part dans les prompts de génération. */
  summary text,
  summary_edited_manually boolean not null default false,
  /* La case de la liste : décide si le résumé est injecté dans les prompts. */
  include_in_context boolean not null default true,

  extraction_status client_asset_extraction_status not null default 'pending',
  extraction_error text,

  created_at timestamptz not null default now()
);

create index if not exists client_assets_workspace_idx
  on client_assets (workspace_id, created_at desc);

-- --- Historique des accroches ------------------------------------------------

-- Lu par `getClientContext()` (30 dernières) pour interdire à la génération
-- de recycler une accroche déjà publiée. Écrit à la **validation** d'un
-- wording, pas à sa génération.
create table if not exists wording_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  subject_id uuid references planning_subjects (id) on delete set null,
  accroche text not null,
  created_at timestamptz not null default now()
);

create index if not exists wording_history_workspace_idx
  on wording_history (workspace_id, created_at desc);

-- --- Colonnes de génération du planning ---------------------------------------

-- La phase wording écrit ses résultats dans le planning : `wording` (texte
-- final, colonne déjà présente depuis 0006), le texte du visuel, les slides
-- d'un carrousel, et l'étape de génération.
alter table planning_subjects
  add column if not exists visual_text text;

alter table planning_subjects
  add column if not exists slides jsonb;

alter table planning_subjects
  add column if not exists wording_status planning_wording_status not null default 'pending';

-- --- Stockage -----------------------------------------------------------------

/* Bucket privé : un questionnaire d'onboarding porte la stratégie et les
   secrets d'un client. 50 Mo par fichier — un lookbook PDF passe, un rush
   vidéo non. Pas de liste de types MIME : les documents de référence sont
   plus variés que les créas (PDF, DOCX, images, texte, CSV…), c'est
   l'application qui filtre. */
insert into storage.buckets (id, name, public, file_size_limit)
values ('client-assets', 'client-assets', false, 52428800)
on conflict (id) do nothing;
