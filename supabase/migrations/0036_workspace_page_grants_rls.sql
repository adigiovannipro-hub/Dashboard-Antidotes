-- RLS des droits par page.
--
-- Deux droits et pas un de plus : l'owner de l'organisation administre, le
-- partenaire lit ses propres lignes et rien d'autre. Personne ne peut lire
-- les droits d'un tiers, ce qui reviendrait à lire la liste des partenaires
-- d'un espace voisin.
alter table workspace_page_grants enable row level security;

drop policy if exists workspace_page_grants_owner on workspace_page_grants;
create policy workspace_page_grants_owner on workspace_page_grants
  for all to authenticated
  using (app.owns_workspace(workspace_id))
  with check (app.owns_workspace(workspace_id));

-- Lecture seule, et sur ses propres lignes : c'est ce que le serveur consulte
-- pour ne pas afficher dans la navigation une page qui rendrait 404.
drop policy if exists workspace_page_grants_self on workspace_page_grants;
create policy workspace_page_grants_self on workspace_page_grants
  for select to authenticated
  using (email = app.current_email());

-- Le `revoke all on all tables` de 0002 ne couvrait que les tables existant à
-- cet instant : chaque migration RLS révoque nominativement les siennes.
revoke all on workspace_page_grants from anon;
