-- ===========================================================================
-- Module Finance — Row Level Security
--
-- Même posture que le module Reçus : c'est la comptabilité d'Antidotes, pas un
-- espace client. Deux niveaux — membre de l'organisation : lecture ; owner :
-- édite ce qui s'édite. Le cron écrit en `service_role`, qui contourne ces
-- politiques : un job planifié n'a pas d'`auth.uid()`.
--
-- La règle qui dessine tout le reste : les tables miroir d'Airwallex (comptes,
-- soldes, factures, journal de synchronisation) ne s'écrivent **jamais** depuis
-- l'application. Les modifier créerait une divergence que la synchronisation
-- suivante écraserait sans prévenir. Ce que l'application a le droit de
-- toucher : la catégorisation, les règles, les justificatifs — ce qui est à
-- nous, pas ce qui est à eux.
-- ===========================================================================

-- --- Fonctions d'aide ------------------------------------------------------

/* Généralisation des fonctions du module Reçus, sous un nom neutre : le test
   d'appartenance à l'organisation n'a rien de spécifique aux reçus. Celles du
   module Reçus restent en place — les prochains modules utiliseront celles-ci. */
create or replace function app.member_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select om.org_id
  from organization_members om
  where om.user_id = auth.uid();
$$;

create or replace function app.is_org_owner(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from organization_members om
    where om.org_id = target_org
      and om.user_id = auth.uid()
      and om.role = 'owner'
  );
$$;

grant execute on function
  app.member_org_ids(),
  app.is_org_owner(uuid)
to authenticated;

-- --- Activation ------------------------------------------------------------

alter table finance_accounts         enable row level security;
alter table finance_balances_history enable row level security;
alter table finance_invoices         enable row level security;
alter table finance_categories       enable row level security;
alter table finance_category_rules   enable row level security;
alter table finance_transactions     enable row level security;
alter table finance_receipts         enable row level security;
alter table finance_sync_runs        enable row level security;

-- --- Miroirs Airwallex : lecture seule -------------------------------------

create policy finance_accounts_read on finance_accounts
  for select to authenticated
  using (org_id in (select app.member_org_ids()));

create policy finance_balances_read on finance_balances_history
  for select to authenticated
  using (org_id in (select app.member_org_ids()));

create policy finance_invoices_read on finance_invoices
  for select to authenticated
  using (org_id in (select app.member_org_ids()));

create policy finance_sync_runs_read on finance_sync_runs
  for select to authenticated
  using (org_id in (select app.member_org_ids()));

/* Aucune politique d'écriture sur ces quatre tables : seul le job y écrit. */

-- --- Dépenses --------------------------------------------------------------

create policy finance_transactions_read on finance_transactions
  for select to authenticated
  using (org_id in (select app.member_org_ids()));

/* Mise à jour seulement : recatégoriser une ligne, corriger une dépense entrée
   par WhatsApp. Ni insertion ni suppression — une dépense naît d'Airwallex ou
   d'un canal automatisé, et une ligne comptable ne s'efface pas. */
create policy finance_transactions_update on finance_transactions
  for update to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

-- --- Justificatifs ---------------------------------------------------------

create policy finance_receipts_read on finance_receipts
  for select to authenticated
  using (org_id in (select app.member_org_ids()));

/* Insertion : le dépôt manuel d'une pièce depuis l'écran. Mise à jour : la
   décision sur un rapprochement. Pas de suppression — écarter une pièce est un
   statut (`rejected`), pas un effacement. */
create policy finance_receipts_insert on finance_receipts
  for insert to authenticated
  with check (app.is_org_owner(org_id));

create policy finance_receipts_update on finance_receipts
  for update to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

-- --- Catégories et règles --------------------------------------------------

create policy finance_categories_read on finance_categories
  for select to authenticated
  using (org_id in (select app.member_org_ids()));

create policy finance_categories_write on finance_categories
  for all to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

create policy finance_category_rules_read on finance_category_rules
  for select to authenticated
  using (org_id in (select app.member_org_ids()));

create policy finance_category_rules_write on finance_category_rules
  for all to authenticated
  using (app.is_org_owner(org_id))
  with check (app.is_org_owner(org_id));

-- --- Stockage --------------------------------------------------------------

/* Comme pour `receipts` : les pièces ne sont jamais servies directement, une
   URL signée est générée avec la clé de service après vérification du droit de
   lecture. L'absence de politique `storage.objects` est ici la politique. */

-- --- Vérification ----------------------------------------------------------

/* Le rôle `anon` ne doit rien pouvoir lire, y compris par accident. */
revoke all on finance_accounts, finance_balances_history, finance_invoices,
  finance_categories, finance_category_rules, finance_transactions,
  finance_receipts, finance_sync_runs from anon;
