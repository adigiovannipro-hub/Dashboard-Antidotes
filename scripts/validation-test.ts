/**
 * Le courriel « Validé » que reçoit l'agence, envoyé par la vraie chaîne à
 * une adresse de test.
 *
 *   pnpm validation:test --vers moi@x.fr
 *
 * Même code que l'action du planning — `notifyApprovals`, vraie publication
 * validée la plus récente, vraie boîte Gmail des Reçus — mais vers l'adresse
 * donnée et elle seule. Le message se relit ensuite par l'API Gmail, puis à
 * l'écran. Étape « Courriel de validation » de « Sondes et diagnostics ».
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith("--") ? value.trim() : undefined;
}

async function main() {
  const to = argument("--vers")?.toLowerCase();
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    console.error("Préciser l'adresse de test : --vers moi@x.fr.");
    process.exit(1);
  }

  const { createAdminClient } = await import("../src/lib/supabase/server");
  const { notifyApprovals } = await import("../src/lib/planning/approval-notify");
  const admin = createAdminClient();

  const { data: subject, error } = await admin
    .from("planning_subjects")
    .select("id, name, updated_by, workspace_id")
    .eq("status", "validated")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !subject) {
    console.error(`Aucune publication validée à prendre pour exemple (${error?.message ?? "aucune"}).`);
    process.exit(1);
  }
  const row = subject as { id: string; name: string; updated_by: string | null };

  const outcome = await notifyApprovals({
    subjectIds: [row.id],
    approverId: row.updated_by ?? "00000000-0000-0000-0000-000000000000",
    recipientsOverride: [to],
  });
  console.log(`« ${row.name} » → ${to} : ${outcome.sent} courriel(s) parti(s)${outcome.reason ? ` — ${outcome.reason}` : ""}.`);
  if (outcome.sent === 0) process.exit(1);
}

void main();
