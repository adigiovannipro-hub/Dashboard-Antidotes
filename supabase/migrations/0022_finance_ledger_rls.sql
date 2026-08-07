-- ===========================================================================
-- Grand livre Airwallex — Row Level Security
--
-- Même posture que les autres miroirs Airwallex du module Finance (0013) :
-- lecture pour tout membre de l'organisation, aucune politique d'écriture —
-- seul le cron écrit, en `service_role`, qui contourne ces politiques.
-- Modifier un mouvement du grand livre depuis l'application créerait une
-- divergence que la synchronisation suivante écraserait sans prévenir.
-- ===========================================================================

alter table finance_ledger_entries enable row level security;

create policy finance_ledger_read on finance_ledger_entries
  for select to authenticated
  using (org_id in (select app.member_org_ids()));

/* Aucune politique insert / update / delete : c'est la politique. */

-- Le rôle `anon` ne doit rien pouvoir lire, y compris par accident — le
-- `revoke` de 0002 ne couvrait que les tables existant à cet instant.
revoke all on finance_ledger_entries from anon;
