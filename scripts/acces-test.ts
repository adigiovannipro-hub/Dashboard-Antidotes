/**
 * Le courriel d'accès à un espace, envoyé par la vraie chaîne à une adresse
 * de test.
 *
 *   pnpm acces:test --vers moi@x.fr                  invitation à l'espace ANMF
 *   pnpm acces:test --vers moi@x.fr --espace bondet
 *   pnpm acces:test --vers moi@x.fr --connexion      le lien de connexion de /login
 *
 * Même code que la gestion des accès et la page de connexion — `sendAccessLink`,
 * vrai lien Supabase, vraie boîte Gmail des Reçus — vers l'adresse donnée et
 * elle seule. C'est la preuve qu'exige toute modification d'un courriel qui
 * part vers un client : le message se relit ensuite par l'API Gmail, puis à
 * l'écran sur Gmail et Mail iPhone. Étape « Courriel d'accès » de « Sondes et
 * diagnostics ».
 *
 * Attention : le lien reçu **connecte** l'adresse de test. À n'envoyer qu'à
 * une adresse à soi.
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CREDENTIALS_ENCRYPTION_KEY",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
] as const;

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith("--") ? value.trim() : undefined;
}

async function main() {
  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    console.error(`Variables absentes : ${missing.join(", ")}.`);
    process.exit(1);
  }

  const to = argument("--vers")?.toLowerCase();
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    console.error("Préciser l'adresse de test : --vers moi@x.fr.");
    process.exit(1);
  }
  const slug = argument("--espace") ?? "anmf";
  const kind = process.argv.includes("--connexion") ? "connexion" : "invitation";
  const site =
    argument("--site") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://dashboard-antidotes-beta.vercel.app";

  const { createAdminClient } = await import("../src/lib/supabase/server");
  const { sendAccessLink } = await import("../src/lib/access/send-access");

  const { data: workspace, error } = await createAdminClient()
    .from("workspaces")
    .select("name, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!workspace) {
    console.error(`Aucun espace « ${slug} ».`);
    process.exit(1);
  }

  const result = await sendAccessLink({
    kind,
    email: to,
    firstName: null,
    workspaceName: kind === "invitation" ? workspace.name : null,
    destination: `/espace/${workspace.slug}`,
    siteUrl: site,
  });

  if (!result.ok) {
    console.error(`Lien refusé : ${result.error}`);
    process.exit(1);
  }

  const link = new URL(result.link);
  console.log(
    [
      `${kind === "invitation" ? "Invitation" : "Lien de connexion"} · ${workspace.name} → ${to}`,
      `Envoyé : ${result.sent ? "oui, par la boîte Gmail des Reçus" : `non — ${result.reason}`}`,
      `Lien : ${link.origin}${link.pathname} · type ${link.searchParams.get("type")} · suivant ${link.searchParams.get("suivant")}`,
    ].join("\n"),
  );
  if (!result.sent) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
