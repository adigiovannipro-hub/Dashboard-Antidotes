/**
 * Synchronisation du Reporting — toutes les sources de toutes les plateformes.
 *
 *   pnpm sync
 *
 * Exécutée chaque jour par `.github/workflows/social-sync.yml`, sur le même
 * modèle qu'Airwallex : la machine GitHub est l'endroit le moins contraint
 * (pas de plafond de durée Vercel, pas de cron Hobby consommé). La condition
 * `react-server` du package.json neutralise `server-only` — nous *sommes* le
 * serveur.
 *
 * Variables requises : NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY. Les jetons de plateformes s'ajoutent connecteur
 * par connecteur (META_SYSTEM_USER_TOKEN en premier, phase 2 du plan).
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

async function main() {
  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    console.error(`Variables absentes : ${missing.join(", ")}.`);
    process.exit(1);
  }

  /* Imports différés : `src/lib/env.ts` valide les variables publiques au
     chargement du module. Des imports statiques lèveraient une `ZodError`
     avant que le contrôle ci-dessus n'ait pu dire lesquelles manquent. */
  const { runReportingSync } = await import("../src/lib/connectors/sync");
  const { createAdminClient } = await import("../src/lib/supabase/server");

  const steps = await runReportingSync({ admin: createAdminClient() });

  if (steps.length === 0) {
    console.log("Aucune source à synchroniser — rien n'est encore connecté.");
    return;
  }

  for (const step of steps) {
    const marque = step.status === "success" ? "✓" : "✗";
    console.log(
      `${marque} ${step.provider} (${step.sourceId.slice(0, 8)}) : ${step.rows} ligne(s)${step.error ? ` — ${step.error}` : ""}`,
    );
  }

  // Sortie non nulle si une source a échoué : l'onglet Actions doit montrer
  // du rouge plutôt qu'un vert menteur. Les sources réussies restent acquises.
  if (steps.some((step) => step.status === "error")) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
