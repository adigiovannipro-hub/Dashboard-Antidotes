-- ===========================================================================
-- Correspondance des noms de clients — Row Level Security
--
-- Même posture que le reste du module : outil interne, comptabilité
-- d'Antidotes. Membre de l'organisation : lecture. Owner : tout.
-- Les fonctions d'aide sont celles de Finance (0013), même colonne de
-- tenant, même table d'appartenance.
-- ===========================================================================

alter table billing_client_aliases enable row level security;

create policy billing_client_aliases_read on billing_client_aliases
  for select to authenticated
  using (org_id in (select app.member_org_ids()));

create policy billing_client_aliases_write on billing_client_aliases
  for all to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

/* Le `revoke all` de 0002 ne couvre que les tables existant à cet instant :
   chaque migration retire nominativement les siennes au rôle `anon`. */
revoke all on billing_client_aliases from anon;
