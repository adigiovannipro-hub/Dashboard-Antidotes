-- ===========================================================================
-- Module Planning Édito — Row Level Security
--
-- Trois niveaux, calqués sur ceux de la Modération :
--   • owner d'organisation : tous les clients, seul à gérer les boards, le
--     mapping des colonnes et les accès ;
--   • editor : lit et rédige le wording de ses clients rattachés ;
--   • viewer : lecture seule.
--
-- Le module est interne : aucun client du dashboard de reporting n'a de ligne
-- dans `planning_members`, et la RLS suffit donc à le rendre invisible même en
-- interrogeant l'API REST directement.
--
-- La structure — boards, mois, couloirs — n'est jamais écrite depuis le
-- navigateur : elle vient de la synchronisation, qui tourne en `service_role`
-- et contourne la RLS. Les politiques d'écriture ne couvrent donc que ce qu'un
-- humain modifie réellement : le wording d'un sujet.
-- ===========================================================================

-- --- Fonctions d'aide ------------------------------------------------------

create or replace function app.planning_client_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pc.id
  from planning_clients pc
  where exists (
    select 1 from organization_members om
    where om.org_id = pc.org_id
      and om.user_id = auth.uid()
      and om.role = 'owner'
  )
  union
  select pm.client_id
  from planning_members pm
  where pm.user_id = auth.uid();
$$;

create or replace function app.planning_writable_client_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pc.id
  from planning_clients pc
  where exists (
    select 1 from organization_members om
    where om.org_id = pc.org_id
      and om.user_id = auth.uid()
      and om.role = 'owner'
  )
  union
  select pm.client_id
  from planning_members pm
  where pm.user_id = auth.uid()
    and pm.role = 'editor';
$$;

create or replace function app.is_planning_owner(target_client uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from planning_clients pc
    join organization_members om on om.org_id = pc.org_id
    where pc.id = target_client
      and om.user_id = auth.uid()
      and om.role = 'owner'
  );
$$;

grant execute on function
  app.planning_client_ids(),
  app.planning_writable_client_ids(),
  app.is_planning_owner(uuid)
to authenticated;

-- --- Activation ------------------------------------------------------------

alter table planning_clients   enable row level security;
alter table planning_members   enable row level security;
alter table planning_boards    enable row level security;
alter table planning_months    enable row level security;
alter table planning_lanes     enable row level security;
alter table planning_subjects  enable row level security;
alter table planning_sync_runs enable row level security;

revoke all on planning_clients, planning_members, planning_boards,
  planning_months, planning_lanes, planning_subjects, planning_sync_runs
from anon;

-- --- Clients et accès ------------------------------------------------------

create policy planning_clients_select on planning_clients
  for select to authenticated
  using (id in (select app.planning_client_ids()));

-- La stratégie déclarée vit sur cette table : seul l'owner peut l'écrire.
create policy planning_clients_write on planning_clients
  for all to authenticated
  using (app.is_planning_owner(id))
  with check (app.is_planning_owner(id));

-- Un éditeur voit son propre rattachement, jamais celui des autres.
create policy planning_members_select on planning_members
  for select to authenticated
  using (user_id = auth.uid() or app.is_planning_owner(client_id));

create policy planning_members_write on planning_members
  for all to authenticated
  using (app.is_planning_owner(client_id))
  with check (app.is_planning_owner(client_id));

-- --- Boards (mapping des colonnes : owner uniquement en écriture) ----------

create policy planning_boards_select on planning_boards
  for select to authenticated
  using (client_id in (select app.planning_client_ids()));

create policy planning_boards_write on planning_boards
  for all to authenticated
  using (app.is_planning_owner(client_id))
  with check (app.is_planning_owner(client_id));

-- --- Structure : lecture seule pour tous ----------------------------------

-- Mois et couloirs reflètent Monday. Les modifier depuis l'interface ferait
-- diverger le miroir de sa source ; la prochaine synchronisation écraserait le
-- changement de toute façon.

create policy planning_months_select on planning_months
  for select to authenticated
  using (client_id in (select app.planning_client_ids()));

create policy planning_lanes_select on planning_lanes
  for select to authenticated
  using (client_id in (select app.planning_client_ids()));

-- --- Sujets ----------------------------------------------------------------

create policy planning_subjects_select on planning_subjects
  for select to authenticated
  using (client_id in (select app.planning_client_ids()));

-- Un éditeur met un wording en file d'attente. La création et la mise à jour
-- des autres colonnes viennent de la synchronisation, en service_role.
create policy planning_subjects_update on planning_subjects
  for update to authenticated
  using (client_id in (select app.planning_writable_client_ids()))
  with check (client_id in (select app.planning_writable_client_ids()));

-- --- Journal des synchronisations -----------------------------------------

create policy planning_sync_runs_select on planning_sync_runs
  for select to authenticated
  using (client_id in (select app.planning_client_ids()));
