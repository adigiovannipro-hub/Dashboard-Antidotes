-- ===========================================================================
-- Pôle « Antidotes », deuxième forme — Row Level Security
--
-- Les consignes de voix sont celles de l'agence : owner-only par
-- `app.is_org_owner()`, comme tout le pôle. `profiles.rail_order` est
-- couvert par `profiles_update_own` (0002) : chacun ne range que son rail.
-- ===========================================================================

alter table antidotes_inbound_settings enable row level security;

create policy antidotes_inbound_settings_read on antidotes_inbound_settings
  for select to authenticated
  using (app.is_org_owner(org_id));

create policy antidotes_inbound_settings_write on antidotes_inbound_settings
  for insert to authenticated
  with check (app.is_org_owner(org_id));

create policy antidotes_inbound_settings_update on antidotes_inbound_settings
  for update to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

create policy antidotes_inbound_settings_delete on antidotes_inbound_settings
  for delete to authenticated
  using (app.is_org_owner(org_id));

revoke all on antidotes_inbound_settings from anon;

notify pgrst, 'reload schema';
