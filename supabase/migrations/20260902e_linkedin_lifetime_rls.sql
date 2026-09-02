-- RLS de `social_lifetime_totals`, calquée sur `social_page_daily` : un
-- membre lit les relevés des espaces qu'il atteint, rien d'autre. L'écriture
-- reste au `service_role` du connecteur — aucune politique `insert`/`update`
-- à `authenticated` : personne ne saisit un compteur à la main.
alter table social_lifetime_totals enable row level security;

create policy social_lifetime_totals_select on social_lifetime_totals
  for select to authenticated
  using (workspace_id in (select app.accessible_workspace_ids()));

-- Le `revoke all` de 0002 ne couvrait que les tables existant à cet instant.
revoke all on social_lifetime_totals from anon;
