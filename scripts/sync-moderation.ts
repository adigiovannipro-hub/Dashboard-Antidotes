/**
 * Synchronisation de la Modération — commentaires Meta — depuis une machine
 * GitHub.
 *
 *   pnpm sync:moderation
 *
 * Greffée sur le workflow `airwallex-sync.yml` (passage du matin), comme la publication
 * du Planning : les deux créneaux cron de Vercel sont pris. Meta accepte les
 * IP GitHub, et le passage coûte quelques secondes par compte affecté.
 *
 * Comme les autres synchronisations, `server-only` est neutralisé par la
 * condition `react-server` de Node — nous *sommes* le serveur.
 *
 * Deux portées, choisies par `MODERATION_SCOPE` ou `--portee` :
 *
 *   • `jour` — ce que l'ouverture de l'écran joue, dans la route. Deux jours de conversations, et
 *     les commentaires des seules publications dont le compteur a bougé.
 *   • `complet` — le défaut, et ce que joue le passage du matin. Soixante
 *     jours, photos de profil et auteurs masqués rattrapés.
 *
 * Le défaut est `complet` : une commande lancée à la main veut le passage
 * entier, et un script qui ne dit rien doit faire le plus de travail, pas le
 * moins.
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
  const { reindexFaqSearch, syncModerationInbox } = await import(
    "../src/lib/moderation/sync"
  );
  const { parseSyncScope, SYNC_SCOPE_LABELS } = await import(
    "../src/lib/moderation/sync-scope"
  );

  const flag = process.argv.indexOf("--portee");
  const scope =
    parseSyncScope(flag >= 0 ? process.argv[flag + 1] : undefined) ??
    parseSyncScope(process.env.MODERATION_SCOPE) ??
    "complet";

  const admin = createAdminClient();
  console.log(`${SYNC_SCOPE_LABELS[scope]}…`);
  const reports = await syncModerationInbox({ admin, scope });

  if (reports.length === 0) {
    console.log("Aucun compte Instagram ou Page affecté : rien à relever.");
  }

  // Le temps par canal, sur chaque ligne : c'est la sonde qui manquait —
  // 750 s partis dans une boîte refusée, sans qu'une ligne du journal le dise.
  const seconds = (ms: number) => `${Math.round(ms / 1000)} s`;
  const timing = (report: (typeof reports)[number]) =>
    report.directMessagesMs > 0
      ? `${seconds(report.elapsedMs)} (dont messages privés ${seconds(report.directMessagesMs)})`
      : seconds(report.elapsedMs);

  for (const report of reports) {
    if (report.error) {
      console.error(
        `  ✗ ${report.workspace} · ${report.channel} · ${report.account} — ${report.error} · ${timing(report)}`,
      );
    } else {
      console.log(
        `  ✓ ${report.workspace} · ${report.channel} · ${report.account} — ${report.threads} fil(s) · ${timing(report)}`,
      );
      if (report.messagesWarning) {
        console.warn(`    ⚠ messages privés : ${report.messagesWarning}`);
      }
    }
  }
  const total = reports.reduce((sum, report) => sum + report.elapsedMs, 0);
  if (reports.length > 0) console.log(`  Σ ${seconds(total)} sur ${reports.length} canal(aux)`);

  // Les entrées FAQ écrites sans vecteur — les corrections se font sur
  // Vercel, où le modèle d'embeddings ne charge pas — s'indexent ici, sur une
  // machine complète. Y passent aussi les vecteurs d'un autre fournisseur.
  const faq = await reindexFaqSearch({ admin });
  if (faq.note) {
    console.warn(
      `  ⚠ FAQ : ${faq.pending} entrée(s) en attente d'indexation — ${faq.note}`,
    );
  } else if (faq.pending > 0) {
    console.log(
      `  ✓ FAQ : ${faq.indexed} entrée(s) indexée(s) pour la recherche sémantique`,
    );
  }

  // Les échecs sont tracés sur `channel_connections` et visibles dans
  // l'inbox : le passage lui-même a fait son travail, il sort en succès pour
  // ne pas alerter à vide.
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
