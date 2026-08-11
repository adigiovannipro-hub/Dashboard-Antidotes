-- ===========================================================================
-- Module « Production » — Row Level Security
--
-- Même posture que « Mon travail » (0015) : le cycle de production, les jobs
-- de génération et l'historique des accroches sont des outils internes de
-- l'owner. Un client d'espace n'a aucune ligne dans `organization_members` :
-- pour lui, ces tables n'existent pas — aucune lecture, aucune écriture, et
-- pas de 403 qui trahirait leur existence.
--
-- Le cahier des charges parle d'un rôle « agency » : il n'existe pas ici, son
-- équivalent est le rôle owner de l'organisation, vérifié par
-- `app.is_org_owner()` (0013) — `security definer`, `search_path` épinglé.
--
-- Les workers de génération écrivent en `service_role` et contournent ces
-- politiques, comme les crons : un traitement de fond n'a pas d'`auth.uid()`.
-- ===========================================================================

-- --- Activation ------------------------------------------------------------

alter table client_phases   enable row level security;
alter table generation_jobs enable row level security;
alter table wording_history enable row level security;

-- --- Phases ----------------------------------------------------------------

create policy client_phases_read on client_phases
  for select to authenticated
  using (app.is_org_owner(org_id));

create policy client_phases_write on client_phases
  for insert to authenticated
  with check (app.is_org_owner(org_id));

create policy client_phases_update on client_phases
  for update to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

create policy client_phases_delete on client_phases
  for delete to authenticated
  using (app.is_org_owner(org_id));

-- --- Jobs de génération ------------------------------------------------------

create policy generation_jobs_read on generation_jobs
  for select to authenticated
  using (app.is_org_owner(org_id));

create policy generation_jobs_write on generation_jobs
  for insert to authenticated
  with check (app.is_org_owner(org_id));

create policy generation_jobs_update on generation_jobs
  for update to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

create policy generation_jobs_delete on generation_jobs
  for delete to authenticated
  using (app.is_org_owner(org_id));

-- --- Historique des accroches ------------------------------------------------

create policy wording_history_read on wording_history
  for select to authenticated
  using (app.is_org_owner(org_id));

create policy wording_history_write on wording_history
  for insert to authenticated
  with check (app.is_org_owner(org_id));

create policy wording_history_update on wording_history
  for update to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

create policy wording_history_delete on wording_history
  for delete to authenticated
  using (app.is_org_owner(org_id));

-- --- Vérification ----------------------------------------------------------

/* Le `revoke all` de la migration 0002 ne couvre que les tables qui
   existaient à cet instant : chaque module révoque nominativement les
   siennes. */
revoke all on client_phases, generation_jobs, wording_history from anon;
