-- ===========================================================================
-- Planning Éditorial de Bondet — août et septembre
--
-- Équivalent SQL de `pnpm seed:planning`, pour amorcer le tableau sans passer
-- par la ligne de commande. Rejouable : les couloirs sont identifiés par leur
-- mois et leur nom, les publications par leur couloir et leur sujet.
--
-- Ce fichier n'est pas une migration : il pose du contenu, pas de la
-- structure. Le supprimer ou le rejouer ne change rien au schéma.
-- ===========================================================================

-- --- Un couloir META pour chacun des deux mois vivants --------------------

-- Instruction séparée, et c'est nécessaire : les CTE d'un même ordre partagent
-- un instantané de la base. Créer les couloirs et poser les publications dans
-- une seule requête ne marcherait pas — la seconde partie ne verrait pas les
-- couloirs que la première vient d'insérer.
insert into planning_lanes (month_id, board_id, workspace_id, platform, name, position)
select m.id, b.id, b.workspace_id, 'meta'::planning_platform, 'META', 0
from planning_months m
join planning_boards b on b.id = m.board_id
join workspaces w on w.id = b.workspace_id
where w.slug = 'bondet'
  and b.slug = 'pe-2026'
  and m.month in (date '2026-08-01', date '2026-09-01')
  and not exists (
    select 1 from planning_lanes l where l.month_id = m.id and l.name = 'META'
  );

-- --- Les publications -----------------------------------------------------

with board as (
  select b.id, b.workspace_id
  from planning_boards b
  join workspaces w on w.id = b.workspace_id
  where w.slug = 'bondet' and b.slug = 'pe-2026'
),
-- Propriétaire par défaut : l'owner de l'organisation, s'il a déjà un profil.
default_owner as (
  select om.user_id
  from organization_members om
  join workspaces w on w.org_id = om.org_id
  join profiles p on p.id = om.user_id
  where w.slug = 'bondet' and om.role = 'owner'
  limit 1
),
lanes as (
  select l.id, m.month
  from planning_lanes l
  join planning_months m on m.id = l.month_id
  join board on board.id = m.board_id
  where l.name = 'META'
    and m.month in (date '2026-08-01', date '2026-09-01')
),
rows_to_insert (month, day, format, name, status, wording, position) as (
  values
    -- Août : validé, en attente de publication.
    (date '2026-08-01',  3, 'post',     'LIVRAISON OFFERTE',    'validated',   null,                   0),
    (date '2026-08-01',  5, 'carousel', 'ELIO COULEURS VERRES', 'validated',   null,                   1),
    (date '2026-08-01', 10, 'reel',     'MOMENTS BONDET 1',     'validated',   null,                   2),
    (date '2026-08-01', 12, 'post',     'JOY SOLAIRE SHOOT',    'validated',   null,                   3),
    (date '2026-08-01', 17, 'reel',     'MOMENTS BONDET 2',     'validated',   null,                   4),
    (date '2026-08-01', 19, 'post',     'FRANÇAISE ACCESSIBLE', 'validated',   null,                   5),
    -- Septembre : en préparation autour du SILMO.
    (date '2026-09-01',  9, 'post',     'ANNONCE SILMO',        'in_progress', 'NUMÉRO STAND ET INFO', 0),
    (date '2026-09-01', 21, 'carousel', 'RELANCE SILMO J-7',    'in_progress', null,                   1),
    (date '2026-09-01', 25, 'reel',     'RELANCE SILMO J-J',    'in_progress', null,                   2)
)
insert into planning_subjects
  (lane_id, month_id, board_id, workspace_id, name, status, format,
   scheduled_on, wording, owner_id, position)
select
  lanes.id,
  m.id,
  board.id,
  board.workspace_id,
  r.name,
  r.status::planning_status,
  r.format::planning_format,
  make_date(2026, extract(month from r.month)::int, r.day),
  r.wording,
  (select user_id from default_owner),
  r.position
from rows_to_insert r
join lanes on lanes.month = r.month
join planning_months m on m.month = r.month
join board on board.id = m.board_id
where not exists (
  select 1 from planning_subjects s
  where s.lane_id = lanes.id and s.name = r.name
);

-- --- Quelques questions, pour que la FAQ ne s'ouvre pas vide ---------------

with faq_board as (
  select b.id, b.workspace_id
  from planning_boards b
  join workspaces w on w.id = b.workspace_id
  where w.slug = 'bondet' and b.slug = 'faq'
),
entries (question, answer, category, position) as (
  values
    ('Quels sont les délais de livraison ?',
     'Nos commandes partent sous 24 h ouvrées et arrivent en 2 à 4 jours en France métropolitaine.',
     'Livraison', 0),
    ('Les montures sont-elles fabriquées en France ?',
     'Oui, en matière biosourcée et avec la certification Origine France Garantie.',
     'Produit', 1),
    ('Comment retourner ou échanger une paire ?',
     'Vous avez 30 jours. Le bon de retour se génère depuis votre espace commande, le renvoi est à notre charge.',
     'SAV & retours', 2)
)
insert into planning_faq_entries
  (board_id, workspace_id, question, answer, category, position, source)
select faq_board.id, faq_board.workspace_id, e.question, e.answer, e.category,
       e.position, 'manual'
from entries e, faq_board
where not exists (
  select 1 from planning_faq_entries f
  where f.board_id = faq_board.id and f.question = e.question
);
