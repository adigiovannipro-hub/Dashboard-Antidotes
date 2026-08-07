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

    console.log("═══ GRAND LIVRE — entrées / sorties EUR par mois ═══");
    // Même exclusion que l'écran : les autorisations carte (HOLD / RELEASE)
    // se compensent et gonfleraient les deux colonnes du même montant.
    const { rows: ledger } = await db.query(`
      select to_char(occurred_at, 'YYYY-MM') as mois,
             count(*)::int as n,
             sum(amount_cents) filter (where amount_cents > 0)::bigint as entrees_cents,
             sum(-amount_cents) filter (where amount_cents < 0)::bigint as sorties_cents
      from finance_ledger_entries where currency = 'EUR'
        and (transaction_type is null or transaction_type not in
             ('ISSUING_AUTHORISATION_HOLD', 'ISSUING_AUTHORISATION_RELEASE'))
      group by 1 order by 1 desc limit 8`);
    console.table(ledger);

    console.log("═══ GRAND LIVRE — types de mouvements ═══");
    const { rows: ledgerTypes } = await db.query(`
      select transaction_type, count(*)::int as n,
             min(amount_cents)::bigint as min_cents, max(amount_cents)::bigint as max_cents
      from finance_ledger_entries group by 1 order by 2 desc limit 12`);
    console.table(ledgerTypes);

    console.log("═══ LOGOS DE MARCHANDS ═══");
    const { rows: logos } = await db.query(`
      select count(*)::int as journalises,
             count(storage_path)::int as trouves,
             (select count(distinct merchant)::int from finance_transactions
              where merchant is not null) as marchands_en_base,
             (select count(*)::int from finance_transactions where merchant is null)
               as depenses_sans_marchand
      from finance_merchant_logos`);
    console.table(logos);

    console.log("═══ CATÉGORIES ═══");
    const { rows: categories } = await db.query(`
      select (select count(*)::int from finance_categories) as categories,
             (select count(*)::int from finance_category_rules) as regles,
             (select count(*)::int from finance_transactions
              where category_id is not null) as depenses_rangees,
             (select count(*)::int from finance_transactions
              where category_raw is not null) as avec_category_raw`);
    console.table(categories);

    console.log("═══ DÉPENSE RÉGLÉE — champs de catégorie et de marchand du brut ═══");
    // Où l'API range la catégorie une fois la dépense réglée — le brut DRAFT
    // n'en montrait aucune.
    const { rows: settledRaws } = await db.query(`
      select external_id, status, raw from finance_transactions
      where status is distinct from 'DRAFT' and raw is not null
      order by occurred_at desc limit 1`);
    for (const row of settledRaws) {
      console.log(`— dépense ${String(row.external_id).slice(0, 12)}… (${row.status ?? "?"})`);
      console.log(`  clés racine : ${Object.keys(row.raw as object).join(", ")}`);
      for (const [path, value] of flattenMatching(row.raw, /categor|merchant|tag|label/i)) {
        console.log(`  ${path} = ${JSON.stringify(value)}`);
      }
    }

    console.log("═══ RAPPROCHEMENT — les deux côtés de la comparaison ═══");
    const { rows: mirror } = await db.query(`
      select merchant, amount_cents, currency,
             billing_amount_cents, billing_currency,
             transaction_date::text, expense_status
      from receipt_expenses
      where transaction_date >= current_date - 3 or transaction_date is null
      order by transaction_date desc nulls first limit 10`);
    console.table(mirror);

    console.log("═══ RAPPROCHEMENT — le JSON brut d'une dépense DRAFT ═══");
    // Les lignes DRAFT du miroir portent amount == billing en EUR alors que
    // l'écran Airwallex montre 154 400 IDR : le montant local vit donc sous
    // une autre clé dans cet état. On liste les champs du brut dont le nom
    // parle de montant, de devise, de marchand ou de statut — valeurs
    // comprises, ce sont des montants, pas des données personnelles.
    const { rows: draftRaws } = await db.query(`
      select external_id, raw from receipt_expenses
      where expense_status = 'DRAFT' and raw is not null
      order by transaction_date desc nulls last limit 2`);
    for (const row of draftRaws) {
      console.log(`— dépense ${String(row.external_id).slice(0, 12)}…`);
      console.log(`  clés racine : ${Object.keys(row.raw as object).join(", ")}`);
      for (const [path, value] of flattenMatching(row.raw, /amount|currency|merchant|status|rate/i)) {
        console.log(`  ${path} = ${JSON.stringify(value)}`);
      }
    }

    const { rows: pending } = await db.query(`
      select merchant, amount_cents, currency, document_date::text,
             status, match_method, expense_id is not null as rapprochee
      from receipt_documents
      where status = 'awaiting_validation'
      order by received_at desc limit 10`);
    console.table(pending);

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

/**
 * Aplati un JSON en couples chemin → valeur et ne garde que les chemins dont
 * une clé correspond au motif. Les tableaux sont parcourus par index.
 */
function flattenMatching(
  value: unknown,
  pattern: RegExp,
  path = "",
): [string, unknown][] {
  if (value === null || typeof value !== "object") {
    return pattern.test(path) ? [[path, value]] : [];
  }
  const entries = Array.isArray(value)
    ? value.map((item, index) => [String(index), item] as const)
    : Object.entries(value);
  return entries.flatMap(([key, child]) =>
    flattenMatching(child, pattern, path ? `${path}.${key}` : key),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
