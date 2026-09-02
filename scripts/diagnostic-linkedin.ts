/**
 * Ce que le projet Composio Platform voit de LinkedIn — lecture seule.
 *
 *   pnpm diagnostic:linkedin
 *
 * Il répond à la seule question qui bloque le branchement : **quelles pages
 * entreprise le compte connecté administre-t-il ?** Les pages se lisent par
 * `organizationAcls`, l'endpoint de la Community Management API de LinkedIn,
 * et c'est lui qui refuse en 403 quand la portée `r_organization_admin` n'a
 * pas été accordée. Le refus ne se distingue pas d'une absence de page dans
 * l'interface : ici, les deux cas s'affichent séparément.
 *
 * À jouer depuis un runner GitHub (étape « Diagnostic LinkedIn » du workflow
 * « Base de données ») : l'API Composio n'est pas joignable depuis
 * l'environnement de développement distant.
 *
 * Variable requise : COMPOSIO_API_KEY (clé de projet Platform, `ak_…`).
 */
import dotenv from "dotenv";
import { Composio } from "@composio/core";

dotenv.config({ path: ".env.local", quiet: true });

const TOOLKIT = "linkedin";
const ORG_ACLS = "LINKEDIN_GET_COMPANY_INFO";
const FOLLOWERS = "LINKEDIN_GET_NETWORK_SIZE";

/** L'identifiant numérique d'une organisation, depuis son URN. */
function organizationId(urn: string): string | null {
  const match = /^urn:li:organization:(\d+)$/.exec(urn);
  return match?.[1] ?? null;
}

/** Les URN d'organisation d'une réponse `organizationAcls`, quelle que soit sa forme. */
function organizationUrns(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const elements = (payload as { elements?: unknown }).elements;
  if (!Array.isArray(elements)) return [];
  const urns: string[] = [];
  for (const element of elements) {
    if (!element || typeof element !== "object") continue;
    const organization = (element as { organization?: unknown }).organization;
    if (typeof organization === "string") urns.push(organization);
  }
  return urns;
}

async function main() {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    console.error("COMPOSIO_API_KEY manquante — clé de projet Platform (ak_…).");
    process.exit(1);
  }

  const composio = new Composio({ apiKey });

  const configs = await composio.authConfigs.list({ toolkit: TOOLKIT });
  console.log(`Configurations d'authentification LinkedIn : ${configs.items.length}`);
  for (const config of configs.items) {
    console.log(`  · ${config.name ?? "(sans nom)"} — ${config.id} — ${config.status}`);
  }

  const accounts = await composio.connectedAccounts.list({
    toolkitSlugs: [TOOLKIT],
    statuses: ["ACTIVE"],
  });
  const active = accounts.items.filter((item) => !item.isDisabled);
  console.log("");
  console.log(`Comptes LinkedIn actifs : ${active.length}`);
  if (active.length === 0) {
    console.log("Aucun compte à interroger : brancher d'abord avec `pnpm composio:lien --toolkit linkedin`.");
    return;
  }

  for (const account of active) {
    console.log("");
    console.log(`── ${account.id} — configuration ${account.authConfig?.id ?? "?"}`);

    let response: { successful?: boolean; data?: unknown; error?: unknown };
    try {
      response = await composio.tools.execute(ORG_ACLS, {
        connectedAccountId: account.id,
        version: "latest",
        arguments: { role: "ADMINISTRATOR", state: "APPROVED", count: 100 },
      });
    } catch (error) {
      console.log(`  Appel impossible : ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    if (!response.successful) {
      console.log(`  Refus LinkedIn : ${String(response.error ?? "sans message")}`);
      console.log("  → si le message cite r_organization_admin, la portée n'a pas été accordée :");
      console.log("    la configuration utilisée n'est pas « linkedin-pages », ou l'application");
      console.log("    OAuth n'est pas approuvée pour la Community Management API.");
      continue;
    }

    const urns = organizationUrns(response.data);
    if (urns.length === 0) {
      console.log("  Aucune page administrée par ce compte (réponse acceptée, liste vide).");
      continue;
    }

    console.log(`  ${urns.length} page(s) administrée(s) :`);
    for (const urn of urns) {
      const id = organizationId(urn);
      let followers = "";
      if (id) {
        try {
          const size = await composio.tools.execute(FOLLOWERS, {
            connectedAccountId: account.id,
            version: "latest",
            arguments: { organization_id: id },
          });
          const count = (size.data as { firstDegreeSize?: number } | undefined)?.firstDegreeSize;
          if (typeof count === "number") followers = ` — ${count} abonnés`;
        } catch {
          /* Le nombre d'abonnés n'est qu'un confort : son absence ne doit pas
             masquer la page trouvée, qui est la réponse cherchée. */
        }
      }
      console.log(`    · ${urn}${followers}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
