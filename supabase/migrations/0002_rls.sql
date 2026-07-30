-- ===========================================================================
-- Antidotes — Row Level Security
--
-- L'isolation entre espaces est garantie ici, dans la base, et non dans l'UI :
-- un client qui appellerait l'API REST directement avec son propre jeton
-- n'obtiendrait toujours aucune ligne d'un autre espace.
--
-- Trois principes :
--   1. `anon` n'a accès à rien. Les pages de partage public sont rendues
--      côté serveur après validation du token, avec la clé service_role.
--   2. Les tables de données sont en lecture seule pour les utilisateurs.
--      Seule la synchronisation (service_role) y écrit.
--   3. Les fonctions d'aide sont `security definer` : elles lisent les tables
--      d'appartenance sans repasser par la RLS, ce qui évite toute récursion
--      de politique.
-- ===========================================================================

grant usage on schema app to authenticated;

-- --- Fonctions d'aide ------------------------------------------------------

-- Espaces visibles par l'utilisateur courant.
-- Un `owner` d'organisation voit tous les espaces de celle-ci, y compris
-- `personal`. Les autres rôles ne voient que les espaces où ils ont une
-- adhésion explicite, et `personal` leur est fermé quoi qu'il arrive.
create or replace function app.accessible_workspace_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select w.id
  from workspaces w
  where exists (
    select 1
    from organization_members om
    where om.org_id = w.org_id
      and om.user_id = auth.uid()
      and om.role = 'owner'
  )
  union
  select m.workspace_id
  from memberships m
  join workspaces w2 on w2.id = m.workspace_id
  where m.user_id = auth.uid()
    and w2.type <> 'personal';
$$;

-- Organisations visibles : celles où l'utilisateur est membre, et celles dont
-- il fréquente au moins un espace (un client doit voir le nom de l'agence).
create or replace function app.accessible_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select om.org_id
  from organization_members om
  where om.user_id = auth.uid()
  union
  select w.org_id
  from workspaces w
  join memberships m on m.workspace_id = w.id
  where m.user_id = auth.uid();
$$;

create or replace function app.is_org_owner(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from organization_members om
    where om.org_id = target_org
      and om.user_id = auth.uid()
      and om.role = 'owner'
  );
$$;

-- Vrai si l'utilisateur est owner de l'organisation propriétaire de l'espace.
create or replace function app.owns_workspace(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from workspaces w
    join organization_members om on om.org_id = w.org_id
    where w.id = target_workspace
      and om.user_id = auth.uid()
      and om.role = 'owner'
  );
$$;

grant execute on function
  app.accessible_workspace_ids(),
  app.accessible_org_ids(),
  app.is_org_owner(uuid),
  app.owns_workspace(uuid)
to authenticated;

-- --- Activation ------------------------------------------------------------

alter table profiles              enable row level security;
alter table organizations         enable row level security;
alter table organization_members  enable row level security;
alter table workspaces            enable row level security;
alter table memberships           enable row level security;
alter table invitations           enable row level security;
alter table data_sources          enable row level security;
alter table sync_runs             enable row level security;
alter table ad_entities           enable row level security;
alter table ad_metrics_daily      enable row level security;
alter table ad_breakdowns_daily   enable row level security;
alter table social_followers      enable row level security;
alter table social_posts          enable row level security;
alter table dashboards            enable row level security;
alter table share_links           enable row level security;
alter table audit_log             enable row level security;

-- `anon` n'a aucun droit : rien ne doit fuiter sans authentification.
revoke all on all tables in schema public from anon;

-- --- Profils ---------------------------------------------------------------

create policy profiles_select on profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from organization_members om
      where om.user_id = id
        and app.is_org_owner(om.org_id)
    )
  );

create policy profiles_update_own on profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- --- Organisation ----------------------------------------------------------

create policy organizations_select on organizations for select to authenticated
  using (id in (select app.accessible_org_ids()));

create policy organizations_update on organizations for update to authenticated
  using (app.is_org_owner(id))
  with check (app.is_org_owner(id));

create policy org_members_select on organization_members for select to authenticated
  using (user_id = auth.uid() or app.is_org_owner(org_id));

create policy org_members_write on organization_members for all to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

-- --- Espaces ---------------------------------------------------------------

create policy workspaces_select on workspaces for select to authenticated
  using (id in (select app.accessible_workspace_ids()));

create policy workspaces_write on workspaces for all to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

-- Un membre voit sa propre adhésion ; seul l'owner voit et modifie celles des
-- autres. Un client ne peut donc pas énumérer qui d'autre a accès.
create policy memberships_select on memberships for select to authenticated
  using (user_id = auth.uid() or app.owns_workspace(workspace_id));

create policy memberships_write on memberships for all to authenticated
  using (app.owns_workspace(workspace_id))
  with check (app.owns_workspace(workspace_id));

create policy invitations_all on invitations for all to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

-- --- Sources de données ----------------------------------------------------

-- Les clients et contributeurs voient l'état de la connexion (dernière
-- synchro, erreur en cours) mais seul l'owner peut la créer ou la modifier.
create policy data_sources_select on data_sources for select to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()));

create policy data_sources_write on data_sources for all to authenticated
  using (app.owns_workspace(workspace_id))
  with check (app.owns_workspace(workspace_id));

create policy sync_runs_select on sync_runs for select to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()));

-- --- Données (lecture seule pour les utilisateurs) -------------------------

create policy ad_entities_select on ad_entities for select to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()));

create policy ad_metrics_select on ad_metrics_daily for select to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()));

create policy ad_breakdowns_select on ad_breakdowns_daily for select to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()));

create policy social_followers_select on social_followers for select to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()));

create policy social_posts_select on social_posts for select to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()));

-- --- Dashboards ------------------------------------------------------------

-- Tous les rôles ayant accès à l'espace peuvent réorganiser et configurer ses
-- dashboards : c'est le choix acté, il n'y a pas de rôle « lecture seule »
-- parmi les utilisateurs authentifiés. La suppression reste à l'owner.
create policy dashboards_select on dashboards for select to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()));

create policy dashboards_insert on dashboards for insert to authenticated
  with check (workspace_id in (select app.accessible_workspace_ids()));

create policy dashboards_update on dashboards for update to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()))
  with check (workspace_id in (select app.accessible_workspace_ids()));

create policy dashboards_delete on dashboards for delete to authenticated
  using (app.owns_workspace(workspace_id));

create policy share_links_select on share_links for select to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()));

create policy share_links_insert on share_links for insert to authenticated
  with check (workspace_id in (select app.accessible_workspace_ids()));

create policy share_links_update on share_links for update to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()))
  with check (workspace_id in (select app.accessible_workspace_ids()));

create policy share_links_delete on share_links for delete to authenticated
  using (app.owns_workspace(workspace_id));

-- --- Journal d'audit -------------------------------------------------------

create policy audit_log_select on audit_log for select to authenticated
  using (org_id is not null and app.is_org_owner(org_id));
