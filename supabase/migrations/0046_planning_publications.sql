-- ===========================================================================
-- Publication automatique — le journal de ce que la machine a publié.
--
-- Une ligne par (publication, réseau). Elle sert trois choses à la fois :
--
--   • le **verrou anti-double** : la contrainte d'unicité fait qu'un seul
--     passage peut revendiquer un couple (sujet, réseau) — deux exécutions
--     concurrentes ne publieront jamais deux fois le même post ;
--   • la **preuve** : identifiant Meta et permalien du post publié ;
--   • l'**erreur visible** : la cause exacte d'un échec, lisible depuis le
--     panneau du sujet, plutôt qu'un silence de cron.
-- ===========================================================================

create type publish_target as enum ('instagram', 'facebook');
create type publish_run_status as enum ('running', 'success', 'error');

create table planning_publications (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references planning_subjects (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  target publish_target not null,
  status publish_run_status not null default 'running',
  -- L'identifiant du média chez Meta, et le lien qui prouve la publication.
  external_id text,
  permalink text,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (subject_id, target)
);

create index planning_publications_workspace_idx
  on planning_publications (workspace_id, started_at desc);

alter table planning_publications enable row level security;
revoke all on planning_publications from anon;

-- Lecture pour quiconque accède à l'espace — le client voit que son post est
-- parti, et pourquoi il n'est pas parti. **Aucune politique d'écriture** : la
-- publication est le fait de la machine seule, via la clé de service qui
-- contourne la RLS. Un client ne « publie » pas une ligne à la main.
create policy planning_publications_select on planning_publications
  for select to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()));
