/**
 * Le relevé du radar inbound — depuis une machine GitHub.
 *
 *   pnpm radar:passage
 *
 * Pour chaque organisation qui veille des comptes : relève les derniers
 * posts de chaque compte actif par le connecteur de son réseau, range le
 * corpus, note abonnés, date et erreur sur le compte. Puis vectorise mes
 * posts qui n'ont pas encore de vecteur (`OPENAI_API_KEY`).
 *
 * `server-only` est neutralisé par la condition `react-server` de Node.
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

const REQUIRED = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;

async function main() {
  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    console.error(`Variables absentes : ${missing.join(", ")}.`);
    process.exit(1);
  }

  const { createAdminClient } = await import("../src/lib/supabase/server");
  const { assembleRadarProviders } = await import("../src/lib/antidotes/inbound/radar/assemble");
  const { collectRadar } = await import("../src/lib/antidotes/inbound/collect");
  const { createRadarStore, embedMissing, listRadarOrgIds } = await import("../src/lib/antidotes/inbound/store");
  const { transcribeMissing } = await import("../src/lib/antidotes/inbound/transcribe");
  const { embedderFromEnv } = await import("../src/lib/antidotes/inbound/embeddings");

  const admin = createAdminClient();
  const providers = await assembleRadarProviders(admin);
  const missingProviders = Object.entries(providers.missing);
  if (missingProviders.length > 0) {
    console.log(`Réseaux sans connecteur : ${missingProviders.map(([platform, why]) => `${platform} (${why})`).join(" · ")}.`);
  }

  const orgIds = await listRadarOrgIds(admin);
  if (orgIds.length === 0) console.log("Aucun compte veillé.");
  let failures = 0;
  for (const orgId of orgIds) {
    // Les seuils des Consignes s'appliquent au relevé : ce qui passe dessous
    // n'entre pas dans le corpus, et ne sera donc jamais à transcrire.
    const { data: settingsRow } = await admin
      .from("antidotes_inbound_settings")
      .select("thresholds")
      .eq("org_id", orgId)
      .maybeSingle();
    const thresholds = (settingsRow as { thresholds?: Record<string, { min_views?: number; min_likes?: number; min_comments?: number }> } | null)?.thresholds;

    const report = await collectRadar({
      store: createRadarStore(admin, orgId),
      providers,
      now: () => new Date(),
      thresholds,
    });
    console.log(
      `→ organisation ${orgId} : ${report.accounts} compte(s) relevé(s), ${report.collected} post(s) rangés${report.belowThreshold > 0 ? `, ${report.belowThreshold} sous le seuil` : ""}`,
    );
    for (const skipped of report.skipped) console.log(`    · ${skipped.account} ignoré — ${skipped.reason}`);
    for (const error of report.errors) console.log(`    ⚠ ${error.account} — ${error.message}`);
    for (const paused of report.paused) {
      console.log(`    ⏸ ${paused.account} mis en pause : le réseau ne le connaît plus. Corriger le pseudo dans Comptes pour le rouvrir.`);
    }
    /* Le passage n'échoue que sur une **panne** : aucun compte relevé alors
       qu'il y en avait, et aucun d'eux mis en pause. Un compte qui refuse
       est un état du compte, pas du passage — il s'affiche sur sa ligne et
       le radar continue ; un compte que le réseau ne connaît plus s'est mis
       en pause et ne reviendra pas demander la même chose. Un rouge chaque
       nuit pour une cause qu'on ne peut pas régler depuis Actions est un
       rouge qu'on cesse de lire, et le jour où c'est vraiment cassé
       personne ne regarde. */
    if (report.accounts > 0 && report.errors.length === report.accounts && report.paused.length === 0) {
      failures += 1;
    }
  }

  /* Les scripts avant les vecteurs : un reel vectorisé sur sa légende ne
     ressemble à rien, et c'est le script que le studio lit. */
  const transcription = await transcribeMissing({ admin });
  console.log(
    `Scripts transcrits : ${transcription.transcribed}${transcription.skipped ? ` · ${transcription.skipped} trop lourds` : ""}${transcription.errors.length ? ` · ${transcription.errors.slice(0, 3).join(" ; ")}` : ""}`,
  );

  const embedder = embedderFromEnv();
  if (embedder) {
    const result = await embedMissing({ admin, embedder });
    console.log(`Vecteurs calculés : ${result.embedded}${result.errors.length ? ` · erreurs : ${result.errors.join(" ; ")}` : ""}`);
  } else {
    console.log("OPENAI_API_KEY absente : pas de vecteurs, le studio rapproche par recoupement lexical.");
  }

  if (failures > 0) {
    console.error(`${failures} organisation(s) n'ont rien pu relever : tous leurs comptes ont refusé.`);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
