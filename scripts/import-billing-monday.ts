/**
 * Reprise du board Monday « ANTIDOTES I ÉCHÉANCES FACTURES » dans le module
 * Échéances — une seule fois, sans doublon.
 *
 *   pnpm import:billing-monday
 *
 * Les données vivent dans `scripts/data/billing-monday.json`, extraites du
 * board le 9 août 2026 et **fusionnées** : le board portait une ligne par
 * mois, le module porte un devis par (client, projet) et ses mensualités.
 * Les statuts viennent des groupes du board — payé reste payé, facturé reste
 * facturé, le rapprochement Airwallex posera ensuite les liens et les dates
 * réelles au fil de ses passages.
 *
 * Idempotent, et prudent deux fois :
 *   • l'identifiant d'un devis est dérivé de (client, projet) en SHA-256 —
 *     rejouer n'insère rien de neuf ;
 *   • un devis déjà présent sous le même couple (client, projet) normalisé —
 *     saisi à la main, par exemple — est laissé intact, mensualités
 *     comprises. Le board ne corrige jamais la main.
 *
 * Les payées arrivent payées, sans autre classement : l'écran n'archive
 * plus rien. Leur date de paiement reste vide — Monday ne la connaît pas,
 * et une date inventée serait pire qu'une absence ; le rapprochement la
 * rapatriera de la facture correspondante.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: ".env.local", quiet: true });

type ImportInstallment = {
  service_month: string;
  amount_cents: number;
  status: "pending" | "issued" | "paid" | "skipped";
  notes: string | null;
};

type ImportEngagement = {
  client_name: string;
  label: string;
  first_month: string;
  months_count: number;
  monthly_amount_cents: number;
  vat_rate: number;
  installments: ImportInstallment[];
};

/** UUID v4-forme, stable, dérivé du couple (client, projet). */
function stableUuid(client: string, label: string): string {
  const hex = createHash("sha256")
    .update(`billing-monday|${normalize(client)}|${normalize(label)}`)
    .digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function addMonths(isoMonth: string, count: number): string {
  const [year, month] = isoMonth.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1 + count, 1)).toISOString().slice(0, 10);
}

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error("SUPABASE_DB_URL est absent — même chaîne que pour db:migrate.");
    process.exit(1);
  }

  const file = path.join(process.cwd(), "scripts", "data", "billing-monday.json");
  const payload = JSON.parse(await readFile(file, "utf8")) as {
    source: string;
    engagements: ImportEngagement[];
  };

  const client = new Client({
    connectionString,
    ssl: connectionString.includes("sslmode=disable")
      ? false
      : { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const { rows: orgs } = await client.query<{ id: string }>(
      "select id from organizations order by created_at limit 1",
    );
    const orgId = orgs[0]?.id;
    if (!orgId) {
      console.error("Aucune organisation en base — migrations non appliquées ?");
      process.exit(1);
    }

    /* Le filet anti-doublon : tout couple (client, projet) déjà en base —
       quelle que soit son origine — est laissé tel quel. */
    const { rows: existing } = await client.query<{
      client_name: string;
      label: string;
    }>("select client_name, label from billing_engagements where org_id = $1", [orgId]);
    const taken = new Set(
      existing.map((row) => `${normalize(row.client_name)}|${normalize(row.label)}`),
    );

    const today = new Date().toISOString().slice(0, 10);

    let created = 0;
    let skippedExisting = 0;
    let lines = 0;

    for (const engagement of payload.engagements) {
      const key = `${normalize(engagement.client_name)}|${normalize(engagement.label)}`;
      if (taken.has(key)) {
        skippedExisting += 1;
        console.log(`= ${engagement.client_name} · ${engagement.label} (déjà en base, intact)`);
        continue;
      }

      const id = stableUuid(engagement.client_name, engagement.label);
      const lastIssue = addMonths(engagement.first_month, engagement.months_count);
      const stillRunning = lastIssue >= today;

      await client.query("begin");
      try {
        const inserted = await client.query(
          `insert into billing_engagements
             (id, org_id, client_name, label, monthly_amount_cents, currency,
              vat_rate, first_month, months_count, status, notes)
           values ($1, $2, $3, $4, $5, 'EUR', $6, $7, $8, $9, $10)
           on conflict (id) do nothing`,
          [
            id,
            orgId,
            engagement.client_name,
            engagement.label,
            engagement.monthly_amount_cents,
            engagement.vat_rate,
            engagement.first_month,
            engagement.months_count,
            stillRunning ? "active" : "ended",
            "Repris du board Monday",
          ],
        );

        for (const line of engagement.installments) {
          const issueOn = addMonths(line.service_month, 1);

          const result = await client.query(
            `insert into billing_installments
               (org_id, engagement_id, service_month, amount_cents, currency,
                vat_rate, issue_on, status, notes)
             values ($1, $2, $3, $4, 'EUR', $5, $6, $7, $8)
             on conflict (engagement_id, service_month) do nothing`,
            [
              orgId,
              id,
              line.service_month,
              line.amount_cents,
              engagement.vat_rate,
              issueOn,
              line.status,
              line.notes,
            ],
          );
          lines += result.rowCount ?? 0;
        }

        await client.query("commit");
        if ((inserted.rowCount ?? 0) > 0) {
          created += 1;
          console.log(
            `→ ${engagement.client_name} · ${engagement.label} : ${engagement.installments.length} mensualités`,
          );
        }
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }

    console.log(
      `\n${created} devis créés (${lines} mensualités), ${skippedExisting} déjà en base laissés intacts.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
