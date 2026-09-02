-- ===========================================================================
-- Récupération automatique des factures — RLS
--
-- Même frontière que les règles de catégories : tout membre de l'organisation
-- lit, l'owner seul écrit. Le passage extérieur, lui, n'a pas de session :
-- il passe par les routes `/api/finance/invoices/*`, qui s'authentifient par
-- secret et écrivent avec la clé de service — comme un cron.
-- ===========================================================================

alter table finance_retrieval_sources enable row level security;

create policy finance_retrieval_sources_read on finance_retrieval_sources
  for select to authenticated
  using (org_id in (select app.member_org_ids()));

create policy finance_retrieval_sources_write on finance_retrieval_sources
  for all to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

/* Le rôle `anon` ne doit rien pouvoir lire, y compris par accident. */
revoke all on finance_retrieval_sources from anon;
