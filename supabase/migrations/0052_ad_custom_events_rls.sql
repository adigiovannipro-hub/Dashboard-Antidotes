-- RLS de `ad_custom_events_daily`, calquée sur `ad_metrics_daily`.
--
-- Même portée, même helper : un membre lit les événements des espaces qu'il
-- atteint, et rien d'autre. L'écriture reste au `service_role` du connecteur —
-- aucune politique `insert`/`update` n'est donnée à `authenticated`, comme
-- pour les métriques publicitaires : personne ne saisit une conversion à la
-- main, elle est mesurée.

alter table ad_custom_events_daily enable row level security;

create policy ad_custom_events_select on ad_custom_events_daily
  for select to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()));

-- Le `revoke all` de 0002 ne couvrait que les tables existant à cet instant.
revoke all on ad_custom_events_daily from anon;
