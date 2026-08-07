-- ===========================================================================
-- Module Échéances de facturation — Row Level Security
--
-- Même posture que Finance et Reçus : outil interne, comptabilité
-- d'Antidotes. Membre de l'organisation : lecture. Owner : tout — ce module
-- est à nous, aucune table n'est un miroir qu'une synchronisation viendrait
-- écraser, l'owner peut donc créer, corriger et supprimer.
--
-- Les fonctions d'aide sont celles du module Finance (`app.member_org_ids`,
-- `app.is_org_owner`), déclarées en 0013 : même colonne de tenant (`org_id`),
-- même table d'appartenance (`organization_members`), aucune raison d'en
-- déclarer d'autres.
-- ===========================================================================

alter table billing_engagements  enable row level security;
alter table billing_installments enable row level security;

-- --- Engagements -----------------------------------------------------------

create policy billing_engagements_read on billing_engagements
  for select to authenticated
  using (org_id in (select app.member_org_ids()));

create policy billing_engagements_write on billing_engagements
  for all to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

-- --- Échéances -------------------------------------------------------------

create policy billing_installments_read on billing_installments
  for select to authenticated
  using (org_id in (select app.member_org_ids()));

create policy billing_installments_write on billing_installments
  for all to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

-- --- Vérification ----------------------------------------------------------

/* Le `revoke all` de 0002 ne couvre que les tables existant à cet instant :
   chaque migration retire nominativement les siennes au rôle `anon`. */
revoke all on billing_engagements, billing_installments from anon;
