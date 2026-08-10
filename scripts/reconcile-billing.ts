/**
 * Rapprochement des Échéances avec les factures Airwallex, à la demande.
 *
 *   pnpm reconcile:billing            applique
 *   pnpm reconcile:billing --dry-run  montre ce qui changerait, n'écrit rien
 *
 * Le même rapprochement tourne toutes les heures dans le sync Finance, mais
 * **depuis `main`** : tant qu'un chantier n'est pas mergé, la vraie base ne
 * voit jamais ses liens se poser, et l'écran affiche donc en double la
 * mensualité et la facture qui la représente. Ce script existe pour ce cas,
 * et pour rejouer le rapprochement après une correction de données.
 *
 * Il réutilise la décision pure de `src/lib/billing/reconcile.ts` — même
 * logique que le cron, aucune règle dupliquée — et parle à Postgres en
 * direct, comme les migrations : une seule variable, `SUPABASE_DB_URL`.
 */
import dotenv from "dotenv";
import { Client } from "pg";

import {
  aliasesFrom,
  reconcile,
  type ReconcilableInstallment,
  type ReconcilableInvoice,
} from "../src/lib/billing/reconcile";

dotenv.config({ path: ".env.local", quiet: true });

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error("SUPABASE_DB_URL est absent — même chaîne que pour db:migrate.");
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: connectionString.includes("sslmode=disable")
      ? false
      : { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const { rows: installments } = await client.query<ReconcilableInstallment>(
      `select i.id, i.status, i.amount_cents, i.vat_rate::float8 as vat_rate, i.currency,
              i.issue_on::text as issue_on, i.matched_invoice_id,
              i.issued_at::text as issued_at,
              i.paid_at::text as paid_at, e.client_name
         from billing_installments i
         join billing_engagements e on e.id = i.engagement_id`,
    );

    const { rows: invoices } = await client.query<ReconcilableInvoice>(
      `select id, client_name, amount_cents, currency, status,
              issued_on::text as issued_on, paid_at::text as paid_at
         from finance_invoices`,
    );

    const { rows: aliasRows } = await client.query<{
      alias: string;
      client_name: string | null;
    }>("select alias, client_name from billing_client_aliases");

    const decisions = reconcile({
      installments,
      invoices,
      aliases: aliasesFrom(aliasRows),
    });
    console.log(
      `${installments.length} mensualités, ${invoices.length} factures,` +
        ` ${aliasRows.length} correspondances → ${decisions.length} décision(s)`,
    );

    const byReason = new Map<string, number>();
    for (const d of decisions) {
      byReason.set(d.reason, (byReason.get(d.reason) ?? 0) + 1);
    }
    for (const [reason, count] of byReason) console.log(`   ${reason} : ${count}`);

    if (dryRun) {
      console.log("\n--dry-run : rien n'a été écrit.");
      return;
    }

    /* Une écriture par décision, chacune ne touchant que les colonnes que la
       décision nomme : le reste de la ligne — un montant ajusté à la main,
       une note — n'a aucune raison d'être réécrit. */
    let applied = 0;
    for (const decision of decisions) {
      const entries = Object.entries(decision.set);
      if (entries.length === 0) continue;
      const assignments = entries.map(([col], i) => `${col} = $${i + 2}`).join(", ");
      const values = entries.map(([, value]) => value);
      const result = await client.query(
        `update billing_installments set ${assignments} where id = $1`,
        [decision.installment_id, ...values],
      );
      applied += result.rowCount ?? 0;
    }
    console.log(`\n${applied} mensualité(s) mise(s) à jour.`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
