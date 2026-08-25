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
] as const;

/* Les secrets propres aux Reçus. Absents, le module n'est simplement pas
   encore configuré : l'étape se saute en l'annonçant, sortie zéro — un
   workflow horaire rouge pour une configuration à venir noierait les vrais
   échecs. Les secrets du socle, eux, restent bloquants : leur absence est
   une erreur, pas un état. */
const RECEIPTS_SETUP = [
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

  const unconfigured = RECEIPTS_SETUP.filter((key) => !process.env[key]?.trim());
  if (unconfigured.length > 0) {
    console.log(
      `Reçus non configurés — étape sautée. Secrets à poser côté GitHub : ${unconfigured.join(", ")}.`,
    );
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      "⚠ ANTHROPIC_API_KEY absente : extraction par règles simples, aucun transfert automatique.",
    );
  }

  const { createAdminClient } = await import("../src/lib/supabase/server");
  const {
    archivePendingMails,
    ingestSource,
    rematchPendingDocuments,
    syncExpenses,
    verifyAttachments,
  } = await import("../src/lib/recus/pipeline");

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

  /* Le rangement des mails déjà partis, que le transfert n'a pas pu faire :
     ceux d'avant le droit d'écriture, et ceux dont le rangement a échoué. */
  for (const source of sources) {
    try {
      const report = await archivePendingMails(source.id);
      if (report.examined > 0) {
        console.log(
          `✓ rangement ${source.email_address} : ${JSON.stringify(report)}`,
        );
      }
    } catch (error) {
      errors.push(`rangement ${source.email_address}`);
      console.error(`✗ rangement ${source.email_address} : ${message(error)}`);
    }
  }

  /* Après l'ingestion : une dépense carte arrive parfois des jours après le
     mail qui la justifie — ce passage redonne leur chance aux pièces en
     attente, contre le miroir tout juste rafraîchi. */
  for (const orgId of orgIds) {
    try {
      const report = await rematchPendingDocuments(orgId);
      console.log(`✓ re-rapprochement ${orgId} : ${JSON.stringify(report)}`);
    } catch (error) {
      errors.push(`re-rapprochement ${orgId}`);
      console.error(`✗ re-rapprochement ${orgId} : ${message(error)}`);
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
