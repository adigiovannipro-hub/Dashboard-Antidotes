-- ===========================================================================
-- Logos de marchands — Row Level Security
--
-- Lecture pour les membres de l'organisation ; aucune politique d'écriture —
-- seule la synchronisation écrit ici, en `service_role`, qui contourne la
-- RLS. Même règle que les miroirs Airwallex du module Finance : ce que
-- l'application n'a pas à modifier n'a pas de politique pour le faire.
-- ===========================================================================

alter table finance_merchant_logos enable row level security;

create policy finance_merchant_logos_read on finance_merchant_logos
  for select to authenticated
  using (org_id in (select app.member_org_ids()));

/* Pas de politique `storage.objects` pour le bucket `merchant-logos` : les
   fichiers sont servis par URL signée générée avec la clé de service après
   vérification du droit de lecture. L'absence de politique est la politique. */

revoke all on finance_merchant_logos from anon;
