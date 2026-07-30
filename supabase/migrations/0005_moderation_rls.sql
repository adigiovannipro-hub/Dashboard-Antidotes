-- ===========================================================================
-- Module Modération — Row Level Security
--
-- Le module est interne. Trois niveaux :
--   • owner d'organisation : accès à tous les clients du module, seul à gérer
--     les connexions API, les accès et l'auto-envoi ;
--   • operator : lit, génère, corrige, envoie sur ses clients rattachés ;
--   • viewer : lecture seule sur ses clients rattachés.
--
-- Un client final ayant reçu un rôle opérateur est un `moderation_members` de
-- son seul client : il ne voit ni les autres clients, ni le journal global, ni
-- les réglages d'auto-envoi. C'est la RLS qui l'en empêche, pas l'interface.
-- ===========================================================================

-- --- Fonctions d'aide ------------------------------------------------------

-- Clients du module accessibles à l'utilisateur courant.
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
  where mm.user_id = auth.uid();
$$;

-- Clients sur lesquels l'utilisateur peut écrire (owner ou operator).
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
    and mm.role = 'operator';
$$;

-- Owner du module pour un client donné : le seul à gérer connexions, accès et
-- auto-envoi.
create or replace function app.is_moderation_owner(target_client uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from moderation_clients mc
    join organization_members om on om.org_id = mc.org_id
    where mc.id = target_client
      and om.user_id = auth.uid()
      and om.role = 'owner'
  );
$$;

grant execute on function
  app.moderation_client_ids(),
  app.moderation_writable_client_ids(),
  app.is_moderation_owner(uuid)
to authenticated;

-- --- Activation ------------------------------------------------------------

alter table moderation_clients      enable row level security;
alter table moderation_members      enable row level security;
alter table channel_connections     enable row level security;
alter table webhook_deliveries      enable row level security;
alter table conversations           enable row level security;
alter table messages                enable row level security;
alter table drafts                  enable row level security;
alter table faq_categories          enable row level security;
alter table faq_entries             enable row level security;
alter table faq_entry_versions      enable row level security;
alter table story_mentions          enable row level security;
alter table monday_imports          enable row level security;
alter table moderation_audit_log    enable row level security;

revoke all on moderation_clients, moderation_members, channel_connections,
  webhook_deliveries, conversations, messages, drafts, faq_categories,
  faq_entries, faq_entry_versions, story_mentions, monday_imports,
  moderation_audit_log
from anon;

-- --- Clients et accès ------------------------------------------------------

create policy moderation_clients_select on moderation_clients
  for select to authenticated
  using (id in (select app.moderation_client_ids()));

-- Les réglages d'auto-envoi vivent sur cette table : seul l'owner peut écrire.
create policy moderation_clients_write on moderation_clients
  for all to authenticated
  using (app.is_moderation_owner(id))
  with check (app.is_moderation_owner(id));

-- Un opérateur voit son propre rattachement, jamais celui des autres : il ne
-- peut donc pas énumérer qui travaille sur quel client.
create policy moderation_members_select on moderation_members
  for select to authenticated
  using (user_id = auth.uid() or app.is_moderation_owner(client_id));

create policy moderation_members_write on moderation_members
  for all to authenticated
  using (app.is_moderation_owner(client_id))
  with check (app.is_moderation_owner(client_id));

-- --- Connexions aux canaux (owner uniquement en écriture) ------------------

create policy channel_connections_select on channel_connections
  for select to authenticated
  using (client_id in (select app.moderation_client_ids()));

create policy channel_connections_write on channel_connections
  for all to authenticated
  using (app.is_moderation_owner(client_id))
  with check (app.is_moderation_owner(client_id));

-- La file de reprise est de l'exploitation : owner seulement, et en lecture.
-- L'écriture passe par le service_role, qui contourne la RLS.
create policy webhook_deliveries_select on webhook_deliveries
  for select to authenticated
  using (client_id is not null and app.is_moderation_owner(client_id));

-- --- Conversations et messages --------------------------------------------

create policy conversations_select on conversations
  for select to authenticated
  using (client_id in (select app.moderation_client_ids()));

-- Un opérateur modifie le statut, le verrou, la priorité. La création vient de
-- l'ingestion (service_role).
create policy conversations_update on conversations
  for update to authenticated
  using (client_id in (select app.moderation_writable_client_ids()))
  with check (client_id in (select app.moderation_writable_client_ids()));

create policy conversations_delete on conversations
  for delete to authenticated
  using (app.is_moderation_owner(client_id));

create policy messages_select on messages
  for select to authenticated
  using (client_id in (select app.moderation_client_ids()));

-- --- Brouillons ------------------------------------------------------------

create policy drafts_select on drafts
  for select to authenticated
  using (client_id in (select app.moderation_client_ids()));

create policy drafts_insert on drafts
  for insert to authenticated
  with check (client_id in (select app.moderation_writable_client_ids()));

create policy drafts_update on drafts
  for update to authenticated
  using (client_id in (select app.moderation_writable_client_ids()))
  with check (client_id in (select app.moderation_writable_client_ids()));

-- --- FAQ -------------------------------------------------------------------

create policy faq_categories_select on faq_categories
  for select to authenticated
  using (client_id in (select app.moderation_client_ids()));

create policy faq_categories_write on faq_categories
  for all to authenticated
  using (client_id in (select app.moderation_writable_client_ids()))
  with check (client_id in (select app.moderation_writable_client_ids()));

create policy faq_entries_select on faq_entries
  for select to authenticated
  using (client_id in (select app.moderation_client_ids()));

create policy faq_entries_write on faq_entries
  for all to authenticated
  using (client_id in (select app.moderation_writable_client_ids()))
  with check (client_id in (select app.moderation_writable_client_ids()));

-- L'historique est en lecture seule pour tout le monde : les versions sont
-- écrites par la fonction d'enregistrement, en service_role.
create policy faq_entry_versions_select on faq_entry_versions
  for select to authenticated
  using (client_id in (select app.moderation_client_ids()));

-- --- Mentions --------------------------------------------------------------

create policy story_mentions_select on story_mentions
  for select to authenticated
  using (client_id in (select app.moderation_client_ids()));

create policy story_mentions_update on story_mentions
  for update to authenticated
  using (client_id in (select app.moderation_writable_client_ids()))
  with check (client_id in (select app.moderation_writable_client_ids()));

-- --- Import Monday (owner uniquement) -------------------------------------

create policy monday_imports_select on monday_imports
  for select to authenticated
  using (app.is_moderation_owner(client_id));

create policy monday_imports_write on monday_imports
  for all to authenticated
  using (app.is_moderation_owner(client_id))
  with check (app.is_moderation_owner(client_id));

-- --- Journal d'audit ------------------------------------------------------

-- Un opérateur voit le journal de ses clients ; il n'existe pas de vue globale
-- pour lui. L'owner voit tout, client par client.
create policy moderation_audit_log_select on moderation_audit_log
  for select to authenticated
  using (client_id is not null and client_id in (select app.moderation_client_ids()));
