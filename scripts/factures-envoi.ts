/**
 * L'émission des factures et leurs relances, exécutée hors de l'hébergeur.
 *
 *   pnpm factures:envoi                le passage réel
 *   pnpm factures:envoi --simulation   décide tout, n'envoie rien
 *
 * Même raison que la synchronisation Finance : Airwallex refuse les adresses
 * IP de Vercel. Ce passage crée des factures et envoie des mails à des
 * clients — il n'a donc rien à faire sur un déclenchement d'écran, et il est
 * volontairement absent de la portée `finance` du workflow.
 *
 * Ce qui l'empêche de faire des dégâts, dans l'ordre où ça agit :
 *
 *   • aucun devis ne porte d'adresse de destinataire tant qu'on n'en met pas
 *     une. Sans adresse, rien ne part — l'interrupteur est là ;
 *   • trois mois d'ancienneté maximum : l'arriéré de 2024 n'est pas réveillé ;
 *   • douze envois par passage au plus ;
 *   • et le journal `billing_invoice_emails`, dont la contrainte d'unicité
 *     interdit qu'un même mail parte deux fois.
 *
 * Variables requises : NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY, AIRWALLEX_CLIENT_ID, AIRWALLEX_API_KEY,
 * AIRWALLEX_ENV=production, CREDENTIALS_ENCRYPTION_KEY (jeton Gmail),
 * GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET.
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
  const simulation = process.argv.includes("--simulation");

  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    console.error(`Variables absentes : ${missing.join(", ")}.`);
    process.exit(1);
  }

  if (process.env.AIRWALLEX_ENV !== "production") {
    console.warn(
      "⚠ AIRWALLEX_ENV n'est pas « production » : le passage vise le bac à sable.",
    );
  }

  /* Imports différés : `src/lib/env.ts` valide au chargement du module, et une
     `ZodError` masquerait le contrôle ci-dessus. */
  const { runInvoiceDispatch } = await import("../src/lib/billing/envoi");
  const { createAdminClient } = await import("../src/lib/supabase/server");

  const admin = createAdminClient();

  const { data, error } = await admin
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

  if (simulation) console.log("— Simulation : rien ne partira —");

  /* Le journal du module Finance porte aussi cette étape : l'écran des
     Factures lit le même bandeau de fraîcheur, et un passage muet doit se
     voir quelque part. Ouvert avant, refermé après, même en échec. */
  const { data: runData } = await admin
    .from("finance_sync_runs")
    .insert({
      org_id: orgId,
      kind: "invoicing",
      status: "running",
      triggered_via: "cron",
    } as never)
    .select("id")
    .single();
  const runId = (runData as { id: number } | null)?.id ?? null;

  const closeRun = async (outcome: {
    status: "success" | "error";
    rows: number;
    error?: string;
  }) => {
    if (runId === null) return;
    await admin
      .from("finance_sync_runs")
      .update({
        status: outcome.status,
        finished_at: new Date().toISOString(),
        rows_synced: outcome.rows,
        error: outcome.error ?? null,
      } as never)
      .eq("id", runId);
  };

  try {
    const report = await runInvoiceDispatch({ orgId, simulation });

    for (const outcome of report.outcomes) {
      if (outcome.kind === "sent") {
        console.log(
          `${simulation ? "≈" : "✓"} ${outcome.emailKind} → ${outcome.to} (${outcome.installmentId})`,
        );
      } else if (outcome.kind === "failed") {
        console.log(`✗ ${outcome.installmentId} — ${outcome.error}`);
      } else {
        console.log(`· ${outcome.installmentId} — ${outcome.reason}`);
      }
    }

    console.log(
      `\n${report.examined} mensualité(s) examinée(s) : ${report.sent} envoi(s), ${report.skipped} ignorée(s), ${report.failed} en échec.`,
    );

    await closeRun({
      status: report.failed > 0 ? "error" : "success",
      rows: report.sent,
      error:
        report.failed > 0
          ? report.outcomes
              .filter((outcome) => outcome.kind === "failed")
              .map((outcome) => (outcome.kind === "failed" ? outcome.error : ""))
              .join(" · ")
              .slice(0, 500)
          : undefined,
    });

    /* Sortie non nulle sur échec : l'onglet Actions doit montrer du rouge
       plutôt qu'un vert menteur. Ce qui est parti reste parti — le journal en
       porte la trace. */
    if (report.failed > 0) process.exit(1);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await closeRun({ status: "error", rows: 0, error: message.slice(0, 500) });
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
