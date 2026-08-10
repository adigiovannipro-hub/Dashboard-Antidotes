-- ===========================================================================
-- Planning Éditorial — colonnes personnalisables et journal d'activité
--
-- Deux capacités reprises de Monday :
--
--   • **construire son tableau** : renommer une colonne, en masquer une, en
--     ajouter (texte, statut, date, personnes, chiffres, menu déroulant, case
--     à cocher), retoucher les étiquettes d'un statut. Les colonnes de base
--     restent du code — leur définition vit dans `src/lib/planning/columns.ts`
--     — et cette table ne stocke que les écarts : un tableau jamais retouché
--     n'a aucune ligne ici.
--
--   • **savoir qui a touché quoi** : chaque modification est journalisée, la
--     dernière s'affiche en bout de ligne, l'historique complet dans le
--     panneau du sujet — l'onglet « Activités » du board d'origine.
-- ===========================================================================

-- --- Colonnes ---------------------------------------------------------------

create type planning_column_type as enum (
  'status', 'dropdown', 'text', 'date', 'people', 'number', 'checkbox'
);

create table planning_columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references planning_boards (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  /* Clé d'une colonne de base (`status`, `wording`…) quand la ligne est un
     écart sur une colonne existante ; `null` pour une colonne ajoutée. */
  builtin_key text,
  type planning_column_type,
  label text,
  position integer,
  hidden boolean not null default false,
  /* Étiquettes d'un statut ou d'un menu déroulant :
     { "labels": [{ "id": "...", "label": "...", "color": "#..." }] }
     Pour une colonne de base à valeurs fixes, seuls libellé et couleur des
     valeurs existantes sont modifiables — le modèle reste un enum. */
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (board_id, builtin_key)
);

create index planning_columns_board_idx on planning_columns (board_id, position);

-- --- Valeurs des colonnes ajoutées -----------------------------------------

-- Indexées par identifiant de colonne. Le jsonb est le bon compromis ici :
-- quelques colonnes par tableau, lues d'un bloc avec la ligne, jamais
-- interrogées seules.
alter table planning_subjects
  add column custom jsonb not null default '{}'::jsonb;

-- Dénormalisé pour la colonne « Last update » : éviter une jointure sur le
-- journal à chaque rendu du tableau.
alter table planning_subjects
  add column updated_by uuid references profiles (id) on delete set null;

-- --- Journal d'activité -----------------------------------------------------

create table planning_activity (
  id bigint generated always as identity primary key,
  subject_id uuid not null references planning_subjects (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  actor_id uuid references profiles (id) on delete set null,
  /* `created`, ou le nom du champ modifié (`status`, `wording`, `custom.<id>`…). */
  field text not null,
  before text,
  after text,
  created_at timestamptz not null default now()
);

create index planning_activity_subject_idx
  on planning_activity (subject_id, created_at desc);

-- --- RLS --------------------------------------------------------------------

alter table planning_columns  enable row level security;
alter table planning_activity enable row level security;

revoke all on planning_columns, planning_activity from anon;

-- La configuration du tableau est collaborative, comme sur Monday : quiconque
-- travaille dans l'espace peut ajouter ou renommer une colonne.
create policy planning_columns_select on planning_columns
  for select to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()));

create policy planning_columns_write on planning_columns
  for all to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()))
  with check (workspace_id in (select app.accessible_workspace_ids()));

-- Le journal se lit et s'alimente ; il ne se réécrit pas. L'absence de
-- politique UPDATE/DELETE vaut interdiction.
create policy planning_activity_select on planning_activity
  for select to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()));

create policy planning_activity_insert on planning_activity
  for insert to authenticated
  with check (workspace_id in (select app.accessible_workspace_ids()));
