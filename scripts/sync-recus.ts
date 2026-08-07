/**
 * Le passage du module Reçus, exécuté hors de l'hébergeur.
 *
 *   pnpm sync:recus
 *
 * Pourquoi ce script existe : Airwallex refuse les adresses IP de Vercel. La
 * route `/api/cron/recus` reste correcte, mais deux de ses trois étapes — la
 * synchronisation des dépenses et la vérification d'accrochage — parlent à
 * l'API Airwallex et ne peuvent pas aboutir de là-bas. Ici, elles passent.
 * Même mécanique que `sync-finance.ts` : condition `react-server` pour
 * neutraliser `server-only`, imports différés pour laisser le contrôle des
 * variables parler avant la `ZodError` de `env.ts`.
 *
 * Les trois étapes, dans l'ordre de la route et pour les mêmes raisons : les
 * dépenses d'abord, pour que les mails lus juste après aient de quoi se
 * rapprocher ; l'ingestion ensuite ; la vérification en dernier, sur ce qui a
 * été transféré aux passages précédents.
 *
 * `ANTHROPIC_API_KEY` est facultative : sans elle, l'extraction retombe sur
 * les règles simples à confiance plafonnée, donc sans transfert automatique —
 * dégradation prévue, pas subie.
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "AIRWALLEX_CLIENT_ID",
  "AIRWALLEX_API_KEY",
  "CREDENTIALS_ENCRYPTION_KEY",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
] as const;

async function main() {
  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    console.error(`Variables absentes : ${missing.join(", ")}.`);
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      "⚠ ANTHROPIC_API_KEY absente : extraction par règles simples, aucun transfert automatique.",
    );
  }

  const { createAdminClient } = await import("../src/lib/supabase/server");
  const { ingestSource, syncExpenses, verifyAttachments } = await import(
    "../src/lib/recus/pipeline"
  );

  const admin = createAdminClient();

  // Tester l'erreur et non le seul `data` : une table absente rendrait une
  // liste vide, donc un « aucune boîte connectée » parfaitement rassurant.
  const { data, error } = await admin
    .from("receipt_sources")
    .select("*")
    .eq("status", "connected");
  if (error) {
    console.error(`Lecture des boîtes : ${error.message}`);
    process.exit(1);
  }

  const sources = (data ?? []) as { id: string; org_id: string; email_address: string }[];
  if (sources.length === 0) {
    console.log("Aucune boîte connectée — rien à faire.");
    return;
  }

  const orgIds = [...new Set(sources.map((source) => source.org_id))];
  const errors: string[] = [];

  for (const orgId of orgIds) {
    try {
      const report = await syncExpenses(orgId);
      console.log(`✓ dépenses ${orgId} : ${JSON.stringify(report)}`);
    } catch (error) {
      errors.push(`dépenses ${orgId}`);
      console.error(`✗ dépenses ${orgId} : ${message(error)}`);
    }
  }

  for (const source of sources) {
    try {
      const report = await ingestSource(source.id);
      console.log(`✓ boîte ${source.email_address} : ${JSON.stringify(report)}`);
    } catch (error) {
      errors.push(`boîte ${source.email_address}`);
      console.error(`✗ boîte ${source.email_address} : ${message(error)}`);
    }
  }

  for (const orgId of orgIds) {
    try {
      const report = await verifyAttachments(orgId);
      console.log(`✓ vérification ${orgId} : ${JSON.stringify(report)}`);
    } catch (error) {
      errors.push(`vérification ${orgId}`);
      console.error(`✗ vérification ${orgId} : ${message(error)}`);
    }
  }

  // Sortie non nulle si une étape a échoué : l'onglet Actions doit montrer du
  // rouge plutôt qu'un vert menteur. Les étapes réussies restent acquises.
  if (errors.length > 0) process.exit(1);
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
