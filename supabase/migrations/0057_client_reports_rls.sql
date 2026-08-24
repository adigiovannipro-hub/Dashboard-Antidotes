-- RLS de la synthèse mensuelle — owner-only, comme tout le module Production.
--
-- `app.is_org_owner` et non `app.accessible_workspace_ids` : un membre de
-- l'espace, client ou contributeur, ne doit pas lire le bilan que l'agence
-- écrit sur son propre compte. C'est le même choix que `client_phases` et
-- `generation_jobs` en 0033.

alter table client_reports enable row level security;

drop policy if exists client_reports_read   on client_reports;
drop policy if exists client_reports_write  on client_reports;
drop policy if exists client_reports_update on client_reports;
drop policy if exists client_reports_delete on client_reports;

create policy client_reports_read on client_reports
  for select to authenticated
  using (app.is_org_owner(org_id));

create policy client_reports_write on client_reports
  for insert to authenticated
  with check (app.is_org_owner(org_id));

create policy client_reports_update on client_reports
  for update to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

create policy client_reports_delete on client_reports
  for delete to authenticated
  using (app.is_org_owner(org_id));

/* Le `revoke all` de 0002 ne couvre que les tables existant à cet instant :
   chaque module révoque nominativement les siennes. */
revoke all on client_reports from anon;
