-- ===========================================================================
-- Module « Mon travail » — Row Level Security
--
-- Posture plus stricte encore que Reçus et Finance : c'est la todo personnelle
-- de l'owner, il n'y a rien à y montrer à un « membre » de l'organisation, et
-- encore moins à un client. Toutes les politiques exigent le rôle owner, via
-- `app.is_org_owner()` posée par la migration 0013.
--
-- Un client d'espace n'a aucune ligne dans `organization_members` : pour lui,
-- ces tables n'existent pas — aucune lecture, aucune écriture, et pas de 403
-- qui trahirait leur existence.
--
-- Le cron écrit en `service_role` et contourne ces politiques : un
-- ordonnanceur n'a pas d'`auth.uid()`.
-- ===========================================================================

-- --- Activation ------------------------------------------------------------

alter table work_cycles      enable row level security;
alter table work_cycle_steps enable row level security;
alter table work_tasks       enable row level security;

-- --- Modèle de cycle -------------------------------------------------------

create policy work_cycles_read on work_cycles
  for select to authenticated
  using (app.is_org_owner(org_id));

create policy work_cycles_write on work_cycles
  for insert to authenticated
  with check (app.is_org_owner(org_id));

create policy work_cycles_update on work_cycles
  for update to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

create policy work_cycles_delete on work_cycles
  for delete to authenticated
  using (app.is_org_owner(org_id));

create policy work_cycle_steps_read on work_cycle_steps
  for select to authenticated
  using (app.is_org_owner(org_id));

create policy work_cycle_steps_write on work_cycle_steps
  for insert to authenticated
  with check (app.is_org_owner(org_id));

create policy work_cycle_steps_update on work_cycle_steps
  for update to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

create policy work_cycle_steps_delete on work_cycle_steps
  for delete to authenticated
  using (app.is_org_owner(org_id));

-- --- Tâches ----------------------------------------------------------------

create policy work_tasks_read on work_tasks
  for select to authenticated
  using (app.is_org_owner(org_id));

create policy work_tasks_write on work_tasks
  for insert to authenticated
  with check (app.is_org_owner(org_id));

create policy work_tasks_update on work_tasks
  for update to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

create policy work_tasks_delete on work_tasks
  for delete to authenticated
  using (app.is_org_owner(org_id));

-- --- Vérification ----------------------------------------------------------

/* Le `revoke all` de la migration 0002 ne couvre que les tables qui
   existaient à cet instant : chaque module révoque nominativement les
   siennes. */
revoke all on work_cycles, work_cycle_steps, work_tasks from anon;
