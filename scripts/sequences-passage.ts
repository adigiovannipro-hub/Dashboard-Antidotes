/**
 * Le passage des séquences du pôle Antidotes — depuis la machine GitHub du
 * workflow horaire.
 *
 *   pnpm sequences:passage
 *
 * Relève les fils Gmail des inscriptions (réponses, rebonds, répondeurs),
 * prépare les observations qui manquent, envoie ce qui est dû dans la fenêtre
 * et sous le plafond de chaque séquence. Tout est journalisé sur les
 * inscriptions et dans le journal des prospects : ce script ne fait que dire
 * ce qui s'est passé.
 *
 * `server-only` est neutralisé par la condition `react-server` de Node — nous
 * *sommes* le serveur.
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

  const { runSequencesPassageNow } = await import("../src/lib/antidotes/sequences/run-passage");
  const report = await runSequencesPassageNow();

  console.log(report.mailbox ? `Boîte : ${report.mailbox}` : "Aucune boîte Gmail connectée.");
  console.log(
    `Fils relus : ${report.checked} · réponses ${report.replies} · rebonds ${report.bounces} · répondeurs ${report.autoReplies}`,
  );
  console.log(`Observations préparées : ${report.personalized}`);
  console.log(`Envois : ${report.sent} · en pause ${report.paused} · reportés ${report.skipped}`);
  if (report.guard) {
    const rate = report.guard.rate === null ? "—" : `${(report.guard.rate * 100).toFixed(1)} %`;
    console.log(`Garde des rebonds : ${report.guard.bounced}/${report.guard.sent} sur 7 jours (${rate})`);
  }
  if (report.blockedBy) console.log(`⚠ ${report.blockedBy}`);
  for (const error of report.errors.slice(-20)) {
    console.log(`  ⚠ inscription ${error.enrollment} — ${error.message}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
