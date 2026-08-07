/**
 * Sonde ponctuelle : quel chemin d'API rend le nom d'un client `bcus_…` ?
 *
 * Les factures ne portent que l'identifiant du client, et les trois chemins
 * devinés en premier lieu ont tous échoué. Ce script prend un identifiant
 * réel en base, essaie chaque chemin candidat et imprime le statut et un
 * aperçu du corps — les clés du JSON, jamais les valeurs, pour ne pas verser
 * de données personnelles dans les journaux.
 *
 * À lancer une fois depuis Actions, puis à supprimer avec son workflow.
 */
import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: ".env.local", quiet: true });

const CANDIDATES = [
  (id: string) => `/api/v1/customers/${id}`,
  (id: string) => `/api/v1/pa/customers/${id}`,
  (id: string) => `/api/v1/billing/customers/${id}`,
  (id: string) => `/api/v1/billing_customers/${id}`,
  (id: string) => `/api/v1/invoicing/customers/${id}`,
  () => `/api/v1/customers?page_size=3`,
  () => `/api/v1/pa/customers?page_size=3`,
] as const;

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error("SUPABASE_DB_URL absent.");
    process.exit(1);
  }

  const db = new Client({
    connectionString,
    ssl: /sslmode=disable/.test(connectionString)
      ? undefined
      : { rejectUnauthorized: false },
  });
  await db.connect();
  const { rows } = await db.query<{ id: string }>(
    "select distinct client_external_id as id from finance_invoices where client_external_id is not null limit 1",
  );
  await db.end();

  const customerId = rows[0]?.id;
  if (!customerId) {
    console.error("Aucun identifiant client en base.");
    process.exit(1);
  }
  console.log(`Identifiant sondé : ${customerId.slice(0, 6)}… (${customerId.length} caractères)`);

  const { call, AirwallexError } = await import("../src/lib/airwallex/transport");

  for (const buildPath of CANDIDATES) {
    const path = buildPath(customerId);
    try {
      const raw = await call<Record<string, unknown>>(path);
      const keys = Object.keys(raw ?? {}).join(", ");
      console.log(`✓ ${path} → 200 — clés : ${keys}`);
      const items = (raw as { items?: Record<string, unknown>[] }).items;
      if (Array.isArray(items) && items[0]) {
        console.log(`  premier élément — clés : ${Object.keys(items[0]).join(", ")}`);
      }
    } catch (error) {
      if (error instanceof AirwallexError) {
        console.log(`✗ ${path} → ${error.status ?? "?"} — ${error.message.slice(0, 160)}`);
      } else {
        console.log(`✗ ${path} → ${error instanceof Error ? error.message.slice(0, 160) : error}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
