-- ===========================================================================
-- Module « Mon travail » — schéma
--
-- La todo unifiée de la page d'accueil : elle remplace le « Mon travail » de
-- Monday. Trois natures de tâches cohabitent dans une même table :
--
--   • les tâches saisies à la main ;
--   • les tâches extraites d'une source (compte rendu Fathom, mail) — mockées
--     en phase 1, branchées en phase 2 ;
--   • les occurrences générées depuis un modèle récurrent : la ligne
--     quotidienne fixe et le cycle de production mensuel de chaque client.
--
-- Une seule table plutôt qu'une par nature : cocher, archiver, passer en
-- retard, rattacher à un client — tout le comportement est commun, et deux
-- tables raconteraient deux fois la même histoire. La nature vit dans
-- `source`, l'identité d'une occurrence dans `dedupe_key`.
--
-- Le cycle mensuel, lui, est un **modèle éditable par client** en base
-- (`work_cycles` + `work_cycle_steps`), pas une constante dans le code : le
-- nombre de semaines, les libellés et l'activation se changent sans
-- redéploiement. Le cron du module lit ce modèle et matérialise les tâches du
-- mois — voir `src/lib/mon-travail/recurrence.ts` pour la règle des semaines.
--
-- Côté tenant, ce module rejoint la génération Reçus / Finance : c'est un
-- outil interne rattaché à `org_id`, jamais montré à un client. Le
-- rattachement à un espace (`workspace_id`) est un simple étiquetage
-- facultatif, pas un cloisonnement.
-- ===========================================================================

-- --- Types -----------------------------------------------------------------

/* D'où vient la tâche. `recurring` couvre les deux générations automatiques —
   ligne quotidienne et cycle mensuel — qui se distinguent par `cycle_step_id`
   (nul pour la quotidienne). */
create type work_task_source as enum ('manual', 'fathom', 'email', 'recurring');

/* `deleted` est un état, pas un `delete` : une occurrence générée qui serait
   réellement effacée serait recréée à l'identique au passage suivant du cron,
   puisque sa clé d'idempotence redeviendrait libre. La ligne reste, porte sa
   clé, et n'est plus jamais affichée ni régénérée. Les tâches manuelles, sans
   clé, sont supprimées pour de bon. */
create type work_task_status as enum ('pending', 'done', 'deleted');

-- --- Modèle de cycle mensuel ------------------------------------------------

/* Un cycle par client. La table ne porte que l'activation : un client en pause
   garde son modèle, il cesse simplement de générer. */
create table work_cycles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (workspace_id)
);

/* Les étapes du cycle. `week_of_month` place l'étape dans le mois ; nulle,
   l'étape est hebdomadaire et se matérialise chaque semaine (« Monitoring et
   modération — en continu »). */
create table work_cycle_steps (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references work_cycles (id) on delete cascade,
  -- Dénormalisées depuis le cycle : la politique RLS tranche sans jointure.
  org_id uuid not null references organizations (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  label text not null,
  week_of_month smallint check (week_of_month between 1 and 5),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index work_cycle_steps_cycle_idx on work_cycle_steps (cycle_id, position);

-- --- Tâches ----------------------------------------------------------------

create table work_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  -- Rattachement client facultatif. `set null` et non `cascade` : la tâche
  -- survit à la fermeture d'un espace, elle perd juste son étiquette.
  workspace_id uuid references workspaces (id) on delete set null,
  -- L'étape de cycle dont la tâche est l'occurrence, pour remonter au modèle.
  cycle_step_id uuid references work_cycle_steps (id) on delete set null,
  title text not null,
  source work_task_source not null default 'manual',
  status work_task_status not null default 'pending',
  -- Jour métier, sans heure ni fuseau : une échéance est un jour, et le
  -- passage en retard se juge au changement de jour.
  due_date date not null,
  done_at timestamptz,
  /* Clé d'idempotence des tâches qui ne naissent pas d'une saisie :
       daily:2026-08-05                        ligne quotidienne
       cycle:<step_id>:2026-08[:w2]            occurrence du cycle mensuel
       fathom:<recording_id>:<n>               phase 2
       email:<message_id>                      phase 2
     Nulle pour une tâche manuelle. */
  dedupe_key text,
  -- Lien vers la source (réunion Fathom, mail) et son libellé lisible.
  source_url text,
  source_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

/* `dedupe_key` est nullable et c'est voulu, contrairement au piège documenté
   sur `planning_subjects.external_id` : ici les NULL — les tâches manuelles —
   ne doivent justement pas être dédupliqués entre eux, et toute clé non nulle
   l'est. C'est cet index que visent les `on conflict do nothing` du cron. */
create unique index work_tasks_dedupe_idx on work_tasks (org_id, dedupe_key);

-- La page lit « en attente jusqu'à J+4 » et « faites récentes » : les deux
-- passent par (statut, échéance).
create index work_tasks_day_idx on work_tasks (org_id, status, due_date);
create index work_tasks_workspace_idx on work_tasks (workspace_id);

-- --- Horodatage ------------------------------------------------------------

create trigger work_tasks_touch
  before update on work_tasks
  for each row execute function app.touch_updated_at();
