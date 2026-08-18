/**
 * Synchronisation de la Modération — commentaires Meta — depuis une machine
 * GitHub.
 *
 *   pnpm sync:moderation
 *
 * Greffée sur le workflow horaire `airwallex-sync.yml`, comme la publication
 * du Planning : les deux créneaux cron de Vercel sont pris. Meta accepte les
 * IP GitHub, et le passage coûte quelques secondes par compte affecté.
 *
 * Comme les autres synchronisations, `server-only` est neutralisé par la
 * condition `react-server` de Node — nous *sommes* le serveur.
 *
 * Variables requises : NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY, CREDENTIALS_ENCRYPTION_KEY.
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CREDENTIALS_ENCRYPTION_KEY",
] as const;

async function main() {
  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    console.error(`Variables absentes : ${missing.join(", ")}.`);
    process.exit(1);
  }

  const { createAdminClient } = await import("../src/lib/supabase/server");
  const { syncModerationInbox } = await import("../src/lib/moderation/sync");

  const reports = await syncModerationInbox({ admin: createAdminClient() });

  if (reports.length === 0) {
    console.log("Aucun compte Instagram ou Page affecté : rien à relever.");
    return;
  }

  for (const report of reports) {
    if (report.error) {
      console.error(
        `  ✗ ${report.workspace} · ${report.channel} · ${report.account} — ${report.error}`,
      );
    } else {
      console.log(
        `  ✓ ${report.workspace} · ${report.channel} · ${report.account} — ${report.threads} fil(s)`,
      );
      if (report.messagesWarning) {
        console.warn(`    ⚠ messages privés : ${report.messagesWarning}`);
      }
    }
  }

  // Les échecs sont tracés sur `channel_connections` et visibles dans
  // l'inbox : le passage lui-même a fait son travail, il sort en succès pour
  // ne pas alerter à vide.
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
