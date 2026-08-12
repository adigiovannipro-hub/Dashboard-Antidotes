-- ===========================================================================
-- Module « Production » — schéma
--
-- Le cycle de production mensuel des cartes client de l'accueil : quatre
-- phases par mois et par client — intentions, wording et créa, programmation,
-- reporting — plus les jobs de génération IA qui les exécutent et
-- l'historique des accroches publiées (anti-répétition de la phase wording).
--
-- Le cahier des charges nomme ces tables `client_phases`, `generation_jobs`
-- et `wording_history` et les fait référencer une table `clients` qui
-- n'existe pas ici : le client est un **espace** (`workspaces`, type
-- `client`). On garde les noms de tables du cahier des charges — le prompt 2
-- s'y référera — mais le rattachement suit les conventions du dépôt :
-- `workspace_id` vers l'espace, `org_id` dénormalisé pour que la politique
-- RLS tranche sans jointure, comme `work_cycles` (0014).
--
-- Les clés de phase restent celles du produit (`intentions`, `wording`,
-- `programmation`, `reporting`) : elles sont aussi les segments d'URL des
-- routes `/api/generate/[phase]` — français par convention — et les noms des
-- fichiers de prompts. Une traduction vers l'anglais imposerait une table de
-- correspondance sans rien apporter.
--
-- Ce module est distinct de `work_cycles` (0014) : celui-ci **génère des
-- tâches** dans la todo, celui-là porte l'**état d'avancement** du mois et
-- déclenche les actions IA. Les deux coexistent.
-- ===========================================================================

-- --- Types -----------------------------------------------------------------

create type production_phase as enum (
  'intentions',
  'wording',
  'programmation',
  'reporting'
);

/* `skipped` : une phase volontairement passée — un mois sans reporting chez
   un client en pause — sort du chemin critique sans se faire passer pour
   faite. */
create type production_phase_status as enum (
  'pending',
  'in_progress',
  'done',
  'skipped'
);

/* `partial` : le job a fini son tour mais des unités ont échoué — la carte
   propose de relancer uniquement les échecs. */
create type generation_job_status as enum (
  'pending',
  'running',
  'done',
  'error',
  'partial'
);

-- --- Phases ----------------------------------------------------------------

/* Une ligne par (espace, phase, mois cible). La ligne n'existe qu'à partir du
   premier changement d'état : une phase sans ligne est `pending`, avec ses
   fenêtres d'échéance par défaut calculées par `src/lib/phases/`. `due_start`
   et `due_end` stockés permettent de déroger au calcul, par client. */
create table client_phases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  phase production_phase not null,
  -- Premier jour du mois cible, comme `planning_months.month`.
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

-- La contrainte unique indexe déjà (workspace_id, …) ; l'org sert la RLS.
create index client_phases_org_idx on client_phases (org_id);

create trigger client_phases_touch
  before update on client_phases
  for each row execute function app.touch_updated_at();

-- --- Jobs de génération ------------------------------------------------------

/* Un job par lancement d'action IA. Le front crée en `pending`, le worker
   passe en `running`, avance `progress_current`, et conclut en `done`,
   `error` ou `partial`. `result` garde la sortie brute (rapport markdown,
   sujets créés, unités en échec pour la reprise). */
create table generation_jobs (
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

-- La carte cherche « le dernier job de cet espace » ; le poll lit par id.
create index generation_jobs_workspace_idx
  on generation_jobs (workspace_id, created_at desc);
create index generation_jobs_org_idx on generation_jobs (org_id);

create trigger generation_jobs_touch
  before update on generation_jobs
  for each row execute function app.touch_updated_at();

-- --- Historique des accroches ------------------------------------------------

/* Les 30 dernières accroches d'un client nourrissent le prompt de wording,
   qui a interdiction de les réutiliser. `subject_id` en `set null` : une
   publication supprimée du planning n'efface pas l'accroche déjà publiée —
   c'est précisément l'historique qu'on veut garder. */
create table wording_history (
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

create index wording_history_workspace_idx
  on wording_history (workspace_id, published_at desc);
create index wording_history_org_idx on wording_history (org_id);
-- FK indexée : le `set null` d'une suppression planning balaierait la table.
create index wording_history_subject_idx on wording_history (subject_id);
