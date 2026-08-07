/**
 * Diagnostic de concordance du module Finance — lecture seule.
 *
 *   pnpm tsx scripts/diagnostic-finance.ts
 *
 * Imprime ce que la base contient réellement, pour le comparer à l'écran
 * Airwallex : statuts bruts des factures, soldes par wallet, dépenses par
 * mois, et la frontière démo / réel. À lancer depuis Actions → Base de
 * données quand la machine locale ne peut pas joindre Supabase.
 *
 * Aucune écriture nulle part : ce script ne fait que des `select`.
 */
import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: ".env.local", quiet: true });

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error("SUPABASE_DB_URL absent.");
    process.exit(1);
  }

  const local = /localhost|127\.0\.0\.1|sslmode=disable/.test(connectionString);
  const db = new Client({
    connectionString,
    ssl: local ? undefined : { rejectUnauthorized: false },
  });
  await db.connect();

  try {
    console.log("═══ FACTURES — statuts bruts vs normalisés ═══");
    const { rows: statuses } = await db.query(`
      select raw_status, status, count(*)::int as n,
             min(issued_on)::text as premiere, max(issued_on)::text as derniere
      from finance_invoices group by 1, 2 order by 3 desc`);
    console.table(statuses);

    console.log("═══ FACTURES — clés du JSON brut (3 exemples) ═══");
    const { rows: rawKeys } = await db.query(`
      select external_id,
             (select string_agg(k, ', ') from jsonb_object_keys(raw) k) as keys
      from finance_invoices where raw is not null limit 3`);
    for (const row of rawKeys) console.log(row.external_id, "→", row.keys);

    console.log("═══ FACTURES — champs de paiement du brut ═══");
    const { rows: payFields } = await db.query(`
      select raw->>'status' as status,
             raw->>'payment_status' as payment_status,
             raw->>'number' as numero,
             client_name as client,
             (amount_cents / 100.0)::text as montant,
             issued_on::text, due_on::text
      from finance_invoices
      where raw is not null
      order by issued_on desc nulls last limit 12`);
    console.table(payFields);

    console.log("═══ FACTURES — émis par mois (tous statuts sauf void) ═══");
    const { rows: byMonth } = await db.query(`
      select to_char(issued_on, 'YYYY-MM') as mois, currency,
             count(*)::int as n, sum(amount_cents)::bigint as cents
      from finance_invoices where status <> 'void'
      group by 1, 2 order by 1 desc limit 8`);
    console.table(byMonth);

    console.log("═══ COMPTES — par identifiant externe ═══");
    const { rows: accounts } = await db.query(`
      select external_id, count(*)::int as n,
             string_agg(distinct currency, ',' order by currency) as devises
      from finance_accounts group by 1`);
    console.table(accounts);

    console.log("═══ SOLDE EUR — dernier instantané par compte EUR ═══");
    const { rows: balances } = await db.query(`
      select a.external_id, a.currency, h.available_cents,
             h.snapshot_hour::text
      from finance_accounts a
      join lateral (
        select available_cents, snapshot_hour from finance_balances_history
        where account_id = a.id order by snapshot_hour desc limit 1
      ) h on true
      where a.currency = 'EUR'`);
    console.table(balances);

    console.log("═══ DÉPENSES — forme des identifiants externes ═══");
    const { rows: idShapes } = await db.query(`
      select case
               when external_id ~ '^exp_[a-z-]+[0-9]{4}$' then 'seed (exp_xxx-0000)'
               when external_id ~ '^[0-9a-f-]{36}$' then 'uuid (Airwallex)'
               else 'autre : ' || left(external_id, 12)
             end as forme, count(*)::int as n
      from finance_transactions group by 1`);
    console.table(idShapes);

    console.log("═══ DÉPENSES — par mois, débit EUR ═══");
    const { rows: spendByMonth } = await db.query(`
      select to_char(occurred_at, 'YYYY-MM') as mois,
             count(*)::int as n,
             sum(billing_amount_cents) filter (where billing_currency = 'EUR')::bigint as debit_eur_cents,
             count(*) filter (where billing_amount_cents is null)::int as sans_debit
      from finance_transactions
      group by 1 order by 1 desc limit 6`);
    console.table(spendByMonth);

    console.log("═══ VESTIGES DE DÉMO ═══");
    const { rows: demo } = await db.query(`
      select 'comptes acct_antidotes' as quoi,
             (select count(*)::int from finance_accounts where external_id = 'acct_antidotes') as n
      union all select 'factures inv_%',
             (select count(*)::int from finance_invoices where external_id like 'inv\\_%')
      union all select 'depenses exp_%',
             (select count(*)::int from finance_transactions where external_id like 'exp\\_%')
      union all select 'justificatifs seed/%',
             (select count(*)::int from finance_receipts where storage_path like 'seed/%')
      union all select 'echeances billing (reel, pas demo)',
             (select count(*)::int from billing_installments)`);
    console.table(demo);
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
