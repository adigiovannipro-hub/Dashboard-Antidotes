-- ===========================================================================
-- Pôle « Antidotes », phase 2 — le sourcing : Row Level Security
--
-- Même posture que le reste du pôle (20260907b) : owner-only par
-- `app.is_org_owner()`. L'owner demande un passage depuis l'écran (insert
-- `queued`) et peut le lire ; la machine GitHub qui l'exécute écrit en
-- `service_role`, hors de ces politiques. Les colonnes ajoutées à
-- `antidotes_prospects` héritent des politiques de la table.
-- ===========================================================================

alter table antidotes_campaign_runs enable row level security;

create policy antidotes_campaign_runs_read on antidotes_campaign_runs
  for select to authenticated
  using (app.is_org_owner(org_id));

create policy antidotes_campaign_runs_write on antidotes_campaign_runs
  for insert to authenticated
  with check (app.is_org_owner(org_id));

create policy antidotes_campaign_runs_update on antidotes_campaign_runs
  for update to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

create policy antidotes_campaign_runs_delete on antidotes_campaign_runs
  for delete to authenticated
  using (app.is_org_owner(org_id));

-- Le `revoke all` de 0002 ne couvre que les tables de l'époque.
revoke all on antidotes_campaign_runs from anon;
