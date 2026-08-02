-- ===========================================================================
-- Espace Bondet — « Meta » devient « Reporting », et le Planning Éditorial
-- prend sa place au-dessus.
--
-- Le dashboard de performance s'appelait « Meta », du nom de sa source. Il
-- s'appelle désormais « Reporting », du nom de ce qu'il fait : TikTok et les
-- autres régies viendront s'y ajouter sans qu'il change de nom une fois de
-- plus.
--
-- Cette migration crée aussi les deux tableaux de la section Planning
-- Éditorial et les mois de 2026. Les publications, elles, sont amorcées par
-- `pnpm seed:planning` : elles changent tous les jours et n'ont rien à faire
-- dans une migration.
-- ===========================================================================

update dashboards
set slug = 'reporting', name = 'Reporting'
where slug = 'meta'
  and workspace_id in (select id from workspaces where slug = 'bondet');

-- --- Les deux tableaux de l'espace Bondet ----------------------------------

with ws as (
  select w.id
  from workspaces w
  join organizations o on o.id = w.org_id
  where o.slug = 'antidotes' and w.slug = 'bondet'
)
-- Les littéraux sont castés explicitement : à travers un `select`, Postgres les
-- type en `text` et ne les convertit pas tout seul vers l'enum, contrairement à
-- un `insert ... values`.
insert into planning_boards (workspace_id, kind, slug, name, year, position)
select ws.id, 'editorial'::planning_board_kind, 'pe-2026',
       'Planning Éditorial 2026', 2026::integer, 0
from ws
union all
select ws.id, 'faq'::planning_board_kind, 'faq', 'FAQ', null::integer, 1
from ws
on conflict (workspace_id, slug) do nothing;

-- --- Les douze mois de 2026 -------------------------------------------------

-- Créés d'avance et vides : ouvrir le tableau sur une année déjà découpée
-- évite d'avoir à créer un groupe avant de pouvoir poser la première idée.
with board as (
  select b.id, b.workspace_id
  from planning_boards b
  join workspaces w on w.id = b.workspace_id
  where w.slug = 'bondet' and b.slug = 'pe-2026'
),
months (label, position) as (
  values
    ('JANVIER', 0), ('FÉVRIER', 1), ('MARS', 2), ('AVRIL', 3),
    ('MAI', 4), ('JUIN', 5), ('JUILLET', 6), ('AOÛT', 7),
    ('SEPTEMBRE', 8), ('OCTOBRE', 9), ('NOVEMBRE', 10), ('DÉCEMBRE', 11)
)
insert into planning_months (board_id, workspace_id, label, month, position)
select
  board.id,
  board.workspace_id,
  months.label,
  make_date(2026, months.position + 1, 1),
  months.position
from board, months
on conflict (board_id, month) do nothing;
