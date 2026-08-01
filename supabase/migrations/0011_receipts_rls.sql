-- ===========================================================================
-- Module Reçus — Row Level Security
--
-- Le module est interne à l'organisation. Deux niveaux seulement, parce qu'il
-- n'y a pas de client final ici : c'est la comptabilité d'Antidotes.
--
--   • membre de l'organisation : lecture ;
--   • owner : décide, transfère, configure les boîtes et les règles.
--
-- Le cron n'a de rôle nulle part : il écrit avec la clé `service_role`, qui
-- contourne ces politiques. C'est délibéré — un job planifié n'a pas de
-- `auth.uid()`, et lui fabriquer une identité serait une porte de plus.
--
-- Aucun espace client n'expose de route vers ce module, et un client n'est
-- membre d'aucune organisation : ces politiques ne lui rendent rien.
-- ===========================================================================

-- --- Fonctions d'aide ------------------------------------------------------

create or replace function app.receipt_readable_org_ids()
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

create or replace function app.is_receipt_owner(target_org uuid)
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
  app.receipt_readable_org_ids(),
  app.is_receipt_owner(uuid)
to authenticated;

-- --- Activation ------------------------------------------------------------

alter table receipt_sources        enable row level security;
alter table receipt_expenses       enable row level security;
alter table receipt_documents      enable row level security;
alter table receipt_merchant_rules enable row level security;
alter table receipt_events         enable row level security;

-- --- Boîtes surveillées ----------------------------------------------------

/* Lecture réservée aux owners, contrairement aux autres tables : la ligne
   porte le refresh token chiffré et l'adresse surveillée. Un membre simple n'a
   aucune raison de voir l'un ou l'autre, même chiffré. */
create policy receipt_sources_read on receipt_sources
  for select to authenticated
  using (app.is_receipt_owner(org_id));

create policy receipt_sources_write on receipt_sources
  for all to authenticated
  using (app.is_receipt_owner(org_id))
  with check (app.is_receipt_owner(org_id));

-- --- Dépenses --------------------------------------------------------------

create policy receipt_expenses_read on receipt_expenses
  for select to authenticated
  using (org_id in (select app.receipt_readable_org_ids()));

/* Aucune politique d'écriture : ces lignes sont un miroir d'Airwallex. Les
   modifier depuis l'application créerait une divergence que la prochaine
   synchronisation écraserait sans prévenir. Seul le job y écrit. */

-- --- Pièces ----------------------------------------------------------------

create policy receipt_documents_read on receipt_documents
  for select to authenticated
  using (org_id in (select app.receipt_readable_org_ids()));

/* Mise à jour seulement, jamais insertion ni suppression : une pièce naît de
   l'ingestion d'un mail et rien d'autre. Un utilisateur décide de son sort, il
   ne l'invente pas — et ne peut pas non plus effacer une pièce partie. */
create policy receipt_documents_decide on receipt_documents
  for update to authenticated
  using (app.is_receipt_owner(org_id))
  with check (app.is_receipt_owner(org_id));

-- --- Règles ----------------------------------------------------------------

create policy receipt_merchant_rules_read on receipt_merchant_rules
  for select to authenticated
  using (org_id in (select app.receipt_readable_org_ids()));

create policy receipt_merchant_rules_write on receipt_merchant_rules
  for all to authenticated
  using (app.is_receipt_owner(org_id))
  with check (app.is_receipt_owner(org_id));

-- --- Journal ---------------------------------------------------------------

create policy receipt_events_read on receipt_events
  for select to authenticated
  using (org_id in (select app.receipt_readable_org_ids()));

/* Le journal ne s'écrit que par la clé de service, et ne se corrige jamais :
   un audit modifiable par ceux qu'il audite ne prouve rien. */

-- --- Stockage --------------------------------------------------------------

/* Les PDF ne sont jamais servis directement au navigateur : l'application
   génère une URL signée avec la clé de service après avoir vérifié le droit de
   lecture. Aucune politique `storage.objects` n'est donc ouverte au rôle
   `authenticated` — l'absence de politique est ici la politique. */

-- --- Vérification ----------------------------------------------------------

/* Le rôle `anon` ne doit rien pouvoir lire, y compris par accident : la
   révocation est explicite plutôt que déduite de l'absence de politique. */
revoke all on receipt_sources, receipt_expenses, receipt_documents,
  receipt_merchant_rules, receipt_events from anon;
