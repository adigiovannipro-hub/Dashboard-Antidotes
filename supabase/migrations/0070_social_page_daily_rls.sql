-- RLS de `social_page_daily`, calquée sur `social_followers` : un membre lit
-- les statistiques des espaces qu'il atteint, rien d'autre. L'écriture reste
-- au `service_role` du connecteur — aucune politique `insert`/`update` à
-- `authenticated` : personne ne saisit une impression à la main.
alter table social_page_daily enable row level security;

create policy social_page_daily_select on social_page_daily
  for select to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()));

-- Le `revoke all` de 0002 ne couvrait que les tables existant à cet instant.
revoke all on social_page_daily from anon;
