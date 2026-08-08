-- ===========================================================================
-- Reporting multi-clients — RLS.
--
-- Même régime que les tables de données du socle (0002) : lecture par tout
-- membre de l'espace, aucune écriture utilisateur — seule la synchronisation
-- (service_role) écrit. Un client qui attaquerait l'API REST directement ne
-- lit rien d'un autre espace et ne modifie rien nulle part.
-- ===========================================================================

alter table social_metrics_daily enable row level security;
alter table social_demographics enable row level security;

create policy social_metrics_select on social_metrics_daily for select to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()));

create policy social_demographics_select on social_demographics for select to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()));

-- Le `revoke all … from anon` de 0002 ne couvrait que les tables de son
-- époque : chaque migration RLS révoque nominativement les siennes.
revoke all on table social_metrics_daily, social_demographics from anon;
