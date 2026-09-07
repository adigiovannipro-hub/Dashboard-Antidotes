-- ===========================================================================
-- Pôle « Antidotes », phase 2 — le sourcing : schéma
--
-- Une campagne « tourne » : elle source des sociétés, les qualifie, cherche
-- le décisionnaire, obtient et vérifie son adresse. Chaque tour est un
-- **passage** (`antidotes_campaign_runs`), qui porte l'état de la machine —
-- l'étape en cours, le taux de survie, les erreurs — parce qu'un passage ne
-- tient pas dans une exécution : il se joue par tranches depuis le workflow
-- horaire GitHub, et un passage interrompu doit reprendre où il en était.
--
-- Le prospect gagne ce que le sourcing sait de lui — note Google, téléphone,
-- verdict de qualification, avancement de l'enrichissement, passage d'origine
-- — sans nouvelle table : c'est la même société, vue par le pipeline.
--
-- Les sociétés **rejetées** par les filtres ne sont pas stockées : elles sont
-- comptées dans le taux de survie du passage, avec la raison, et c'est tout.
-- Un kanban qui montrerait cent quarante rejets pour soixante qualifiés
-- deviendrait illisible, et c'est précisément le filtre-avant-d'enrichir qui
-- garde le coût sous contrôle.
-- ===========================================================================

-- --- Types -----------------------------------------------------------------

/* `queued` : demandé depuis l'écran, en attente d'une machine. `running` : une
   machine y travaille, `heartbeat_at` le prouve. `done` / `error` : terminé —
   une erreur d'étape n'arrête pas le passage, elle s'inscrit dans `errors` ;
   `error` n'est que l'échec du sourcing lui-même, sans lequel rien ne suit. */
create type antidotes_run_status as enum ('queued', 'running', 'done', 'error');

/* L'étape en cours, pour reprendre un passage interrompu là où il en était. */
create type antidotes_run_stage as enum ('sourcing', 'discovering', 'verifying', 'done');

-- --- Passages --------------------------------------------------------------

create table antidotes_campaign_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  campaign_id uuid not null references antidotes_campaigns (id) on delete cascade,
  status antidotes_run_status not null default 'queued',
  stage antidotes_run_stage not null default 'sourcing',
  /* Le taux de survie, étape par étape :
       {sourced, qualified, to_review, contact_found, email_valid, email_risky,
        rejected: {"raison": n}} */
  stats jsonb not null default '{}'::jsonb,
  -- [{at, step, message, prospect?}] : ce qui a échoué, sans arrêter le reste.
  errors jsonb not null default '[]'::jsonb,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  -- Posé à chaque tranche de travail : un passage `running` sans battement
  -- depuis plus d'une heure est un passage mort, que le suivant reprend.
  heartbeat_at timestamptz,
  created_at timestamptz not null default now()
);

create index antidotes_campaign_runs_campaign_idx
  on antidotes_campaign_runs (campaign_id, created_at desc);
-- Le passage horaire cherche « ce qui attend ou tourne » d'une organisation.
create index antidotes_campaign_runs_org_status_idx
  on antidotes_campaign_runs (org_id, status);

-- --- Ce que le sourcing apprend d'un prospect -------------------------------

alter table antidotes_prospects
  -- La note Google, proxy de qualité : le filtre « note minimale » la lit.
  add column rating numeric(2, 1),
  -- Le standard de la société — un appel reste un geste du pipeline.
  add column phone text,
  /* Le verdict de qualification, pour comprendre pourquoi une société est là :
       {outcome: 'qualified' | 'to_review', reasons: [], size_ratio, checked_at} */
  add column qualification jsonb not null default '{}'::jsonb,
  /* L'avancement de l'enrichissement, par étape, pour ne pas refaire ce qui
     est fait et pour lire ce qui a échoué :
       {discovery_at, discovery_source, candidates, email_at, email_provider,
        errors: []} */
  add column enrichment jsonb not null default '{}'::jsonb,
  -- Le passage qui l'a sourcé ou touché en dernier : c'est lui qui relie un
  -- prospect au taux de survie de son passage.
  add column last_run_id uuid references antidotes_campaign_runs (id) on delete set null,
  add constraint antidotes_prospects_rating_range check (
    rating is null or (rating >= 0 and rating <= 5)
  );

create index antidotes_prospects_last_run_idx
  on antidotes_prospects (last_run_id)
  where last_run_id is not null;
