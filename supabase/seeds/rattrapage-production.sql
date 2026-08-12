-- ===========================================================================
-- Rattrapage du module Production — migrations 0032 et 0033, en un collage
--
-- À coller dans l'éditeur SQL de Supabase. La liaison Supabase↔GitHub
-- n'applique pas nos migrations : ce fichier est le geste manuel qui met la
-- vraie base à niveau, comme le rattrapage 0009→0031 du Planning Éditorial.
--
-- **Idempotent et convergent** : rejouable sans risque, et il rattrape aussi
-- un passage précédent interrompu à mi-chemin. C'est nécessaire : l'éditeur
-- SQL de Supabase n'honore pas toujours le `begin`/`commit` ci-dessous, donc
-- une première tentative qui échoue peut laisser des tables à demi créées.
--
-- Le préambule ne supprime donc rien à l'aveugle : il ne retire une table que
-- si elle porte les marques d'une forme périmée **et** qu'elle est vide. Une
-- table d'une autre forme qui contient des lignes interrompt le script avec un
-- message explicite plutôt que d'effacer quoi que ce soit.
--
-- Il enregistre aussi les deux migrations dans `app.schema_migrations`, pour
-- que `pnpm db:status` cesse de les réclamer. Les sommes de contrôle sont
-- celles des fichiers `supabase/migrations/0032_*.sql` et `0033_*.sql` ; si
-- ces fichiers changent un jour, le runner signalera « modifiée depuis » —
-- c'est le comportement voulu, on n'y touche pas.
-- ===========================================================================

begin;

-- --- Préambule : rattraper un passage interrompu ----------------------------

/* `create table if not exists` ne fait rien quand la table existe — même sous
   une forme incomplète. L'index qui suit cherche alors une colonne absente et
   tout s'arrête. On remet donc à plat, mais **sous garde** : uniquement une
   table à la forme périmée, et uniquement si elle est vide. */
do $$
declare
  vestige record;
  manquantes text[];
  peuplee boolean;
begin
  for vestige in
    select * from (values
      ('client_phases', array[
        'id', 'org_id', 'workspace_id', 'phase', 'target_month', 'status',
        'completed_at', 'due_start', 'due_end', 'created_at', 'updated_at']),
      ('generation_jobs', array[
        'id', 'org_id', 'workspace_id', 'phase', 'target_month', 'status',
        'progress_current', 'progress_total', 'result', 'error_message',
        'started_at', 'finished_at', 'created_at', 'updated_at']),
      ('wording_history', array[
        'id', 'org_id', 'workspace_id', 'subject_id', 'hook', 'full_wording',
        'platform', 'published_at', 'created_at'])
    ) as t (nom, colonnes)
  loop
    continue when to_regclass('public.' || vestige.nom) is null;

    select array_agg(attendue)
      into manquantes
      from unnest(vestige.colonnes) as attendue
     where not exists (
       select 1
         from information_schema.columns
        where table_schema = 'public'
          and table_name = vestige.nom
          and column_name = attendue
     );

    -- Forme conforme : on n'y touche pas.
    continue when manquantes is null;

    execute format('select exists (select 1 from public.%I limit 1)', vestige.nom)
      into peuplee;

    if peuplee then
      raise exception
        'La table % existe sous une autre forme (colonnes absentes : %) et contient des lignes. Rattrapage interrompu, rien n''a été supprimé : cette table est à examiner à la main.',
        vestige.nom, array_to_string(manquantes, ', ');
    end if;

    raise notice
      'Vestige vide sur % (colonnes absentes : %) — la table est recréée.',
      vestige.nom, array_to_string(manquantes, ', ');
    execute format('drop table public.%I cascade', vestige.nom);
  end loop;
end $$;

-- --- Types -----------------------------------------------------------------

do $$ begin
  create type production_phase as enum
    ('intentions', 'wording', 'programmation', 'reporting');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type production_phase_status as enum
    ('pending', 'in_progress', 'done', 'skipped');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type generation_job_status as enum
    ('pending', 'running', 'done', 'error', 'partial');
exception when duplicate_object then null;
end $$;

-- --- Phases ----------------------------------------------------------------

create table if not exists client_phases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  phase production_phase not null,
  target_month date not null,
  status production_phase_status not null default 'pending',
  completed_at timestamptz,
  due_start date,
  due_end date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_phases_month_first_day check (extract(day from target_month) = 1),
  constraint client_phases_due_window check (
    due_start is null or due_end is null or due_end >= due_start
  ),
  unique (workspace_id, phase, target_month)
);

create index if not exists client_phases_org_idx on client_phases (org_id);

do $$ begin
  create trigger client_phases_touch
    before update on client_phases
    for each row execute function app.touch_updated_at();
exception when duplicate_object then null;
end $$;

-- --- Jobs de génération ------------------------------------------------------

create table if not exists generation_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  phase production_phase not null,
  target_month date not null,
  status generation_job_status not null default 'pending',
  progress_current integer not null default 0,
  progress_total integer not null default 0,
  result jsonb,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint generation_jobs_month_first_day check (extract(day from target_month) = 1),
  constraint generation_jobs_progress check (
    progress_current >= 0 and progress_total >= 0
  )
);

create index if not exists generation_jobs_workspace_idx
  on generation_jobs (workspace_id, created_at desc);
create index if not exists generation_jobs_org_idx on generation_jobs (org_id);

do $$ begin
  create trigger generation_jobs_touch
    before update on generation_jobs
    for each row execute function app.touch_updated_at();
exception when duplicate_object then null;
end $$;

-- --- Historique des accroches ------------------------------------------------

create table if not exists wording_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  subject_id uuid references planning_subjects (id) on delete set null,
  hook text not null,
  full_wording text,
  platform planning_platform,
  published_at date,
  created_at timestamptz not null default now()
);

create index if not exists wording_history_workspace_idx
  on wording_history (workspace_id, published_at desc);
create index if not exists wording_history_org_idx on wording_history (org_id);
create index if not exists wording_history_subject_idx on wording_history (subject_id);

-- --- Row Level Security ------------------------------------------------------

alter table client_phases   enable row level security;
alter table generation_jobs enable row level security;
alter table wording_history enable row level security;

/* `create policy if not exists` n'existe pas : on supprime puis on recrée.
   Sans effet de bord — une politique est une déclaration, pas une donnée. */
drop policy if exists client_phases_read   on client_phases;
drop policy if exists client_phases_write  on client_phases;
drop policy if exists client_phases_update on client_phases;
drop policy if exists client_phases_delete on client_phases;

create policy client_phases_read on client_phases
  for select to authenticated
  using (app.is_org_owner(org_id));

create policy client_phases_write on client_phases
  for insert to authenticated
  with check (app.is_org_owner(org_id));

create policy client_phases_update on client_phases
  for update to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

create policy client_phases_delete on client_phases
  for delete to authenticated
  using (app.is_org_owner(org_id));

drop policy if exists generation_jobs_read   on generation_jobs;
drop policy if exists generation_jobs_write  on generation_jobs;
drop policy if exists generation_jobs_update on generation_jobs;
drop policy if exists generation_jobs_delete on generation_jobs;

create policy generation_jobs_read on generation_jobs
  for select to authenticated
  using (app.is_org_owner(org_id));

create policy generation_jobs_write on generation_jobs
  for insert to authenticated
  with check (app.is_org_owner(org_id));

create policy generation_jobs_update on generation_jobs
  for update to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

create policy generation_jobs_delete on generation_jobs
  for delete to authenticated
  using (app.is_org_owner(org_id));

drop policy if exists wording_history_read   on wording_history;
drop policy if exists wording_history_write  on wording_history;
drop policy if exists wording_history_update on wording_history;
drop policy if exists wording_history_delete on wording_history;

create policy wording_history_read on wording_history
  for select to authenticated
  using (app.is_org_owner(org_id));

create policy wording_history_write on wording_history
  for insert to authenticated
  with check (app.is_org_owner(org_id));

create policy wording_history_update on wording_history
  for update to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

create policy wording_history_delete on wording_history
  for delete to authenticated
  using (app.is_org_owner(org_id));

/* Le `revoke all` de 0002 ne couvre que les tables existant à cet instant :
   chaque module révoque nominativement les siennes. */
revoke all on client_phases, generation_jobs, wording_history from anon;

-- --- Traçabilité -------------------------------------------------------------

/* Les sommes de contrôle des deux fichiers de migration, pour que le runner
   les considère appliquées et n'essaie pas de les rejouer. */
insert into app.schema_migrations (name, checksum)
values
  ('0032_production_schema.sql', 'RATTRAPAGE-0032'),
  ('0033_production_rls.sql',    'RATTRAPAGE-0033')
on conflict (name) do nothing;

/* PostgREST — la couche qui sert l'API REST de Supabase — garde un cache du
   schéma. Sans ce signal, il continue de répondre « relation does not exist »
   sur des tables pourtant créées, et l'application affiche « Cycle
   indisponible » alors que tout est en place. Supabase recharge en principe
   tout seul sur DDL ; ce rappel ne coûte rien et ferme le cas. */
notify pgrst, 'reload schema';

commit;

-- Vérification : trois lignes attendues, 12 politiques.
select
  (select count(*) from information_schema.tables
     where table_schema = 'public'
       and table_name in ('client_phases', 'generation_jobs', 'wording_history')) as tables,
  (select count(*) from pg_policies
     where schemaname = 'public'
       and tablename in ('client_phases', 'generation_jobs', 'wording_history')) as politiques;
