/**
 * Renvoie les derniers envois de factures, l'objet complété.
 *
 *   pnpm factures:renvoi --nombre 4 --suffixe " (renvoi suite à bug réception mail)"
 *   pnpm factures:renvoi --nombre 4 --simulation     décide et affiche, n'envoie rien
 *   pnpm factures:renvoi --nombre 1 --vers moi@x.fr  le dernier envoi, vers cette
 *                                                    adresse, sans journal : un test
 *                                                    de la vraie chaîne
 *
 * Pour le jour où un défaut d'affichage a touché ce qui est parti — même
 * modèle, même facture relue chez Airwallex, même destinataire, et une mention
 * en fin d'objet qui dit au client pourquoi il reçoit deux fois la même chose.
 * Tourne sur un runner GitHub, comme l'émission : Airwallex refuse les IP de
 * Vercel. Étape « Renvoi des factures » de db-admin.
 *
 * Variables requises : les mêmes que `factures:envoi`.
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

const REQUIRED_ALWAYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const REQUIRED_TO_SEND = [
  "AIRWALLEX_CLIENT_ID",
  "AIRWALLEX_API_KEY",
  "CREDENTIALS_ENCRYPTION_KEY",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
] as const;

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const simulation = process.argv.includes("--simulation");
  const count = Number.parseInt(argument("--nombre") ?? "4", 10);
  const testRecipient = argument("--vers")?.trim() || undefined;
  const subjectSuffix = argument("--suffixe") ?? (testRecipient ? " (test)" : "");

  if (!Number.isInteger(count) || count <= 0) {
    console.error("--nombre attend un entier strictement positif.");
    process.exit(1);
  }
  if (!simulation && !subjectSuffix.trim()) {
    console.error(
      "--suffixe est obligatoire : un renvoi sans mention dans l'objet est un doublon aux yeux du client.",
    );
    process.exit(1);
  }

  const required = simulation
    ? REQUIRED_ALWAYS
    : [...REQUIRED_ALWAYS, ...REQUIRED_TO_SEND];
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    console.error(`Variables absentes : ${missing.join(", ")}.`);
    process.exit(1);
  }

  /* Imports différés : `src/lib/env.ts` valide au chargement du module, et une
     `ZodError` masquerait le contrôle ci-dessus. */
  const { resendRecentInvoices } = await import("../src/lib/billing/envoi");
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
  if (testRecipient) {
    console.log(`— Test : tout part vers ${testRecipient}, rien n'est journalisé —`);
  }

  const outcomes = await resendRecentInvoices({
    orgId,
    count,
    subjectSuffix,
    simulation,
    testRecipient,
  });

  for (const outcome of outcomes) {
    if (outcome.kind === "sent") {
      console.log(
        `${simulation ? "≈" : "✓"} ${outcome.to} — « ${outcome.subject} » (${outcome.installmentId})`,
      );
    } else {
      console.log(`✗ ${outcome.installmentId} — ${outcome.error}`);
    }
  }

  const failed = outcomes.filter((outcome) => outcome.kind === "failed").length;
  console.log(
    `\n${outcomes.length} envoi(s) repris : ${outcomes.length - failed} parti(s), ${failed} en échec.`,
  );
  if (outcomes.length === 0) console.log("Le journal ne porte aucun envoi de facture.");
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
