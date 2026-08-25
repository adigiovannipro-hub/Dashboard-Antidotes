-- RLS des tables du trafic web, calquée sur `ad_metrics_daily`.
--
-- Même portée, même helper : un membre lit le trafic des espaces qu'il
-- atteint, et rien d'autre. L'écriture reste au `service_role` du connecteur —
-- aucune politique `insert`/`update` n'est donnée à `authenticated`, comme
-- pour les métriques publicitaires : personne ne saisit une session à la
-- main, elle est mesurée.

alter table web_metrics_daily      enable row level security;
alter table web_metrics_monthly    enable row level security;
alter table web_breakdowns_monthly enable row level security;
alter table web_pages_monthly      enable row level security;

create policy web_metrics_daily_select on web_metrics_daily
  for select to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()));

create policy web_metrics_monthly_select on web_metrics_monthly
  for select to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()));

create policy web_breakdowns_monthly_select on web_breakdowns_monthly
  for select to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()));

create policy web_pages_monthly_select on web_pages_monthly
  for select to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()));

-- Le `revoke all` de 0002 ne couvrait que les tables existant à cet instant.
revoke all on web_metrics_daily      from anon;
revoke all on web_metrics_monthly    from anon;
revoke all on web_breakdowns_monthly from anon;
revoke all on web_pages_monthly      from anon;
