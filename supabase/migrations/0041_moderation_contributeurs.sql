-- ===========================================================================
-- 0041 — La Modération s'ouvre aux contributeurs
--
-- Suite de 0040 : la frontière entre contributeur et client porte sur les
-- modules. Le Contexte a été traité ; voici la Modération.
--
-- Le pont existait déjà et n'était pas emprunté : `moderation_clients` porte
-- une colonne `workspace_id` — le rattachement optionnel à un espace du
-- dashboard, posé dès 0004. Un contributeur d'un espace doit donc atteindre
-- le client de modération rattaché à cet espace, et lui seul.
--
-- On n'ajoute aucune ligne dans `moderation_members` : dupliquer l'adhésion
-- créerait deux sources de vérité qui divergeraient au premier retrait de
-- partenaire. C'est le lien espace ↔ client de modération qui fait foi.
--
-- Les deux helpers gardent leur nom et leur signature : les 13 tables du
-- module s'appuient dessus, aucune politique n'est réécrite.
-- ===========================================================================

/* Les clients de modération lisibles : owner de l'organisation, membre
   explicite, ou contributeur de l'espace rattaché. */
create or replace function app.moderation_client_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select mc.id
  from moderation_clients mc
  where exists (
    select 1 from organization_members om
    where om.org_id = mc.org_id
      and om.user_id = auth.uid()
      and om.role = 'owner'
  )
  union
  select mm.client_id
  from moderation_members mm
  where mm.user_id = auth.uid()
  union
  -- Le pont : contributeur de l'espace rattaché. Un client d'espace n'entre
  -- jamais ici — c'est toute la différence entre les deux rôles.
  select mc.id
  from moderation_clients mc
  join memberships m on m.workspace_id = mc.workspace_id
  where mc.workspace_id is not null
    and m.user_id = auth.uid()
    and m.role = 'contributor';
$$;

/* Les clients de modération sur lesquels on écrit. Un contributeur travaille
   la boîte, sinon l'ouvrir n'aurait aucun intérêt : il y répond. */
create or replace function app.moderation_writable_client_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select mc.id
  from moderation_clients mc
  where exists (
    select 1 from organization_members om
    where om.org_id = mc.org_id
      and om.user_id = auth.uid()
      and om.role = 'owner'
  )
  union
  select mm.client_id
  from moderation_members mm
  where mm.user_id = auth.uid()
    and mm.role = 'operator'
  union
  select mc.id
  from moderation_clients mc
  join memberships m on m.workspace_id = mc.workspace_id
  where mc.workspace_id is not null
    and m.user_id = auth.uid()
    and m.role = 'contributor';
$$;

grant execute on function app.moderation_client_ids() to authenticated;
grant execute on function app.moderation_writable_client_ids() to authenticated;
