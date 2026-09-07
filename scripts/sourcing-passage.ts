/**
 * Le passage de sourcing du pôle Antidotes — depuis une machine GitHub.
 *
 *   pnpm sourcing:passage
 *
 * Reprend les passages en file (demandés depuis l'écran de campagne) et ceux
 * restés `running` sans battement depuis plus d'une heure — une machine
 * coupée au milieu d'une tranche. Chaque passage reçoit un budget de temps ;
 * au-delà il sauve son avancement et rend la main, le passage suivant
 * reprend où il en était. Tout est journalisé dans le passage lui-même : ce
 * script ne fait que dire ce qui s'est passé.
 *
 * Les fournisseurs se branchent par l'environnement — voir
 * `src/lib/antidotes/sourcing/assemble.ts` ; un fournisseur absent est nommé,
 * jamais tu.
 *
 * Comme les autres synchronisations, `server-only` est neutralisé par la
 * condition `react-server` de Node — nous *sommes* le serveur.
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

/** Vingt minutes par passage : le workflow en accorde trente au job entier. */
const BUDGET_MS = 20 * 60_000;

async function main() {
  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    console.error(`Variables absentes : ${missing.join(", ")}.`);
    process.exit(1);
  }

  const { createAdminClient } = await import("../src/lib/supabase/server");
  const { createSourcingStore, listRunnableRuns, loadCampaign } = await import(
    "../src/lib/antidotes/sourcing/store"
  );
  const { assembleProviders } = await import("../src/lib/antidotes/sourcing/assemble");
  const { runCampaign, STALE_RUN_MINUTES } = await import("../src/lib/antidotes/sourcing/run");
  const { buildFunnel, rejectionBreakdown } = await import("../src/lib/antidotes/sourcing/funnel");

  const admin = createAdminClient();
  const providers = assembleProviders();
  if (providers.missing.length > 0) {
    console.log(`Fournisseurs non branchés : ${providers.missing.join(" · ")}.`);
  }

  const started = Date.now();
  const staleBefore = new Date(started - STALE_RUN_MINUTES * 60_000).toISOString();
  const runs = await listRunnableRuns(admin, { staleBefore });
  if (runs.length === 0) {
    console.log("Aucun passage en attente.");
    return;
  }

  const store = createSourcingStore(admin);
  let failures = 0;

  for (const run of runs) {
    const remaining = BUDGET_MS - (Date.now() - started);
    if (remaining < 60_000) {
      console.log("Budget épuisé : les passages restants attendront le prochain tour.");
      break;
    }
    const campaign = await loadCampaign(admin, run.campaign_id);
    if (!campaign) {
      console.error(`  ✗ passage ${run.id} — campagne introuvable`);
      await store.saveRun(run.id, { status: "error", finished_at: new Date().toISOString() });
      failures += 1;
      continue;
    }

    console.log(`→ ${campaign.name} (${run.status}, étape ${run.stage})`);
    const report = await runCampaign({
      store,
      providers,
      campaign,
      run,
      now: () => new Date(),
      deadline: new Date(Date.now() + remaining),
    });

    const funnel = buildFunnel(report.stats)
      .map((step) => `${step.label} ${step.value}`)
      .join(" → ");
    const rejected = rejectionBreakdown(report.stats)
      .map((entry) => `${entry.reason} ${entry.count}`)
      .join(", ");
    const mark = report.status === "error" ? "✗" : report.interrupted ? "…" : "✓";
    console.log(`  ${mark} ${funnel}${rejected ? ` · rejets : ${rejected}` : ""}`);
    if (report.interrupted) console.log("    budget épuisé, reprise au prochain passage");
    for (const error of report.errors.slice(-10)) {
      console.log(`    ⚠ ${error.step}${error.prospect ? ` · ${error.prospect}` : ""} — ${error.message}`);
    }
    if (report.status === "error") failures += 1;
  }

  if (failures > 0) process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
