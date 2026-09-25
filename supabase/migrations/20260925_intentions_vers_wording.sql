-- Les briefs de la colonne « Intention » rejoignent la cellule Wording, puis
-- la colonne disparaît — Bondet et ANMF seulement, à la demande du 25/09/2026.
--
-- Depuis le même jour, la génération d'intentions pose son brief dans
-- `wording` et ne crée plus de colonne « Intention » ; la rédaction se greffe
-- sur ce brief et sur le titre du sujet. Les sujets posés avant la bascule
-- portaient le leur dans `custom`, sous l'identifiant de la colonne.
--
-- Le texte change de forme au passage, comme le veut le nouveau prompt :
-- les lignes « Template : » et « Thème : » partent (le template se lit dans
-- le titre du sujet), l'étiquette « Créa : » tombe, « Texte visuel : X »
-- devient « Texte à l'image : « X » ».
--
-- Seuls les sujets en attente de rédaction (« — », « WORDING À FAIRE »)
-- reçoivent le brief : ailleurs, la cellule porte une caption, et y ajouter
-- un brief le ferait publier tel quel. Relevé avant écriture : 25 sujets, tous
-- en « — », aucun avec un wording. Si un sujet d'un autre statut porte une
-- intention au moment du passage, la migration échoue en le nommant plutôt
-- que de supprimer son contenu avec la colonne.
--
-- Idempotente : sans colonne « Intention » sur ces tableaux, elle ne fait rien.

do $$
declare
  bloquants text;
begin
  select string_agg(format('%s · %s (%s)', w.slug, s.name, s.status), ', ')
    into bloquants
  from planning_columns c
  join planning_subjects s on s.board_id = c.board_id
  join workspaces w on w.id = c.workspace_id
  where c.label = 'Intention'
    and c.builtin_key is null
    and w.slug in ('bondet', 'anmf')
    and nullif(btrim(s.custom ->> c.id::text), '') is not null
    and s.status not in ('idea', 'wording_todo');

  if bloquants is not null then
    raise exception 'Intentions sur des sujets déjà rédigés, rien n''est déplacé : %', bloquants;
  end if;
end $$;

with colonnes as (
  select c.id, c.board_id
  from planning_columns c
  join workspaces w on w.id = c.workspace_id
  where c.label = 'Intention'
    and c.builtin_key is null
    and w.slug in ('bondet', 'anmf')
),
briefs as (
  select
    s.id,
    c.id as column_id,
    btrim(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(s.custom ->> c.id::text, '^(Template|Thème) : [^\n]*\n?', '', 'gn'),
            '^Créa : ', '', 'gn'
          ),
          '^Texte visuel : ([^\n]*)', 'Texte à l''image : « \1 »', 'gn'
        ),
        '\n{3,}', E'\n\n', 'g'
      ),
      E' \n'
    ) as brief
  from planning_subjects s
  join colonnes c on c.board_id = s.board_id
  where s.custom ? c.id::text
)
update planning_subjects s
set
  wording = case
    when b.brief = '' then s.wording
    when nullif(btrim(coalesce(s.wording, '')), '') is null then b.brief
    else btrim(s.wording) || E'\n\n' || b.brief
  end,
  custom = s.custom - b.column_id::text
from briefs b
where s.id = b.id;

delete from planning_columns c
using workspaces w
where w.id = c.workspace_id
  and c.label = 'Intention'
  and c.builtin_key is null
  and w.slug in ('bondet', 'anmf');
