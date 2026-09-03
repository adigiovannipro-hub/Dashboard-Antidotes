-- ===========================================================================
-- Factures — Row Level Security du journal des envois
--
-- Même posture que le reste du module : membre de l'organisation, lecture ;
-- owner, tout. Les helpers sont ceux de Finance (`app.member_org_ids`,
-- `app.is_org_owner`, déclarés en 0013) — même colonne de tenant, même table
-- d'appartenance.
--
-- Les colonnes ajoutées à `billing_engagements` et `billing_installments`
-- sont couvertes par les politiques existantes : une politique porte sur la
-- ligne, pas sur ses colonnes. Rien à redéclarer là-bas.
--
-- Ce journal contient des adresses de clients et le texte des mails qui leur
-- ont été envoyés. Il n'a rien à faire dans un espace client, et ne sort donc
-- pas de l'organisation.
-- ===========================================================================

alter table billing_invoice_emails enable row level security;

create policy billing_invoice_emails_read on billing_invoice_emails
  for select to authenticated
  using (org_id in (select app.member_org_ids()));

create policy billing_invoice_emails_write on billing_invoice_emails
  for all to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

/* Le `revoke all` de 0002 ne couvre que les tables existant à cet instant :
   chaque migration retire nominativement les siennes au rôle `anon`. */
revoke all on billing_invoice_emails from anon;
