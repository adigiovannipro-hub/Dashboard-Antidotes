/**
 * Synchronisation Airwallex, exécutée hors de l'hébergeur.
 *
 *   pnpm sync:finance
 *
 * Pourquoi ce script existe : Airwallex refuse les adresses IP de Vercel. Le
 * même appel, avec les mêmes clés, obtient un jeton depuis une machine GitHub
 * et une page « 403 Forbidden » depuis une fonction Vercel — prouvé par la
 * sonde `airwallex-probe.yml`. La route `/api/cron/sync-finance` reste en
 * place et reste correcte ; elle ne peut simplement pas aboutir de là où elle
 * s'exécute.
 *
 * Le pipeline n'est pas réécrit : c'est le même `runFinanceSync` que la route
 * et que le bouton « Synchroniser maintenant ». Seul l'endroit d'où il part
 * change. Il faut pour cela neutraliser `server-only`, ce que fait la
 * condition `react-server` de Node — voir le script `sync:finance` du
 * package.json. Ce n'est pas un contournement : nous *sommes* le serveur.
 *
 * Variables requises : NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY, AIRWALLEX_CLIENT_ID, AIRWALLEX_API_KEY, et
 * AIRWALLEX_ENV=production.
 *
 * La clé anon n'est pas utilisée ici — les écritures passent par la clé de
 * service — mais `src/lib/env.ts` valide tout le bloc public au chargement,
 * et ce bloc appartient à l'application. Elle est publique par construction :
 * l'exiger ne coûte rien.
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

async function main() {
  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    console.error(`Variables absentes : ${missing.join(", ")}.`);
    process.exit(1);
  }

  if (process.env.AIRWALLEX_ENV !== "production") {
    // Avertir sans bloquer : le bac à sable est un choix légitime, mais il ne
    // contient aucune dépense réelle et l'écran paraîtrait vide sans raison.
    console.warn(
      "⚠ AIRWALLEX_ENV n'est pas « production » : la synchronisation vise le bac à sable.",
    );
  }

  /* Imports différés, et c'est nécessaire : `src/lib/env.ts` valide les
     variables publiques au chargement du module. Des imports statiques
     lèveraient une `ZodError` avant que le contrôle ci-dessus n'ait pu dire
     lesquelles manquent — l'erreur exacte, mais illisible. */
  const { runFinanceSync } = await import("../src/lib/finance/sync");
  const { createAdminClient } = await import("../src/lib/supabase/server");

  // La comptabilité est celle d'Antidotes : l'organisation la plus ancienne
  // est la bonne. Tester l'erreur et non le seul `data` — une table absente
  // rendrait une liste vide, donc un « rien à faire » parfaitement rassurant.
  const { data, error } = await createAdminClient()
    .from("organizations")
    .select("id")
    .order("created_at")
    .limit(1);
  if (error) {
    console.error(`Lecture des organisations : ${error.message}`);
    process.exit(1);
  }

  const orgId = (data as { id: string }[] | null)?.[0]?.id;
  if (!orgId) {
    console.error("Aucune organisation en base — migrations non appliquées ?");
    process.exit(1);
  }

  const report = await runFinanceSync({ orgId, triggeredVia: "cron" });

  for (const step of report) {
    const marque = step.status === "success" ? "✓" : "✗";
    console.log(
      `${marque} ${step.kind} : ${step.rows} ligne(s)${step.error ? ` — ${step.error}` : ""}`,
    );
  }

  // Sortie non nulle si une étape a échoué : l'onglet Actions doit montrer du
  // rouge plutôt qu'un vert menteur. Les étapes réussies restent acquises,
  // chacune ayant écrit sa ligne au journal.
  if (report.some((step) => step.status === "error")) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
