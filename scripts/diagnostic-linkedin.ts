/**
 * Ce que le projet Composio Platform voit de LinkedIn — lecture seule.
 *
 *   pnpm diagnostic:linkedin [--user <identifiant>] [--version 20250909_00]
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
 * L'identifiant d'utilisateur est celui sous lequel le compte a été rangé au
 * branchement (« agence » par défaut, comme `pnpm composio:lien`). Composio
 * l'exige à l'exécution manuelle d'un outil et ne le rend pas dans la liste
 * des comptes — sans lui, l'appel échoue sur « Toolkit version not specified »,
 * message trompeur qui n'a rien à voir avec la version.
 *
 * Composio refuse « latest » à l'exécution manuelle d'un outil (« Toolkit
 * version not specified »), et n'accepte qu'une version datée. Le diagnostic
 * étant en lecture seule, il lève le garde-fou plutôt que d'épingler une
 * version qui périmera : `--version` reste là pour figer si besoin.
 *
 * Variable requise : COMPOSIO_API_KEY (clé de projet Platform, `ak_…`).
 */
import dotenv from "dotenv";
import { Composio } from "@composio/core";

dotenv.config({ path: ".env.local", quiet: true });

/** Un `--nom valeur` de la ligne de commande. */
function argValue(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

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

  const userId = argValue("user") ?? process.env.COMPOSIO_DEFAULT_USER_ID ?? "agence";
  const version = argValue("version");
  const versionOptions = version
    ? { version }
    : { version: "latest", dangerouslySkipVersionCheck: true };
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
  console.log(`Comptes LinkedIn actifs : ${active.length} (interrogés sous « ${userId} »)`);
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
        userId,
        connectedAccountId: account.id,
        ...versionOptions,
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
      /* Une liste vide se lit de deux façons : le compte n'administre
         vraiment rien, ou la réponse n'a pas la forme attendue. La montrer
         telle quelle tranche — c'est le seul moyen de ne pas conclure à tort
         que le client n'a pas de page. */
      console.log("  Aucune page lue. Réponse brute de LinkedIn :");
      console.log(`  ${JSON.stringify(response.data).slice(0, 1500)}`);

      /* Second essai avec l'autre rôle que LinkedIn expose : un compte qui
         ne « gère » pas la page peut quand même y publier du sponsorisé. */
      const alternate = await composio.tools.execute(ORG_ACLS, {
        userId,
        connectedAccountId: account.id,
        ...versionOptions,
        arguments: { role: "DIRECT_SPONSORED_CONTENT_POSTER", state: "APPROVED", count: 100 },
      });
      console.log("  Rôle DIRECT_SPONSORED_CONTENT_POSTER :");
      console.log(
        `  ${alternate.successful ? JSON.stringify(alternate.data).slice(0, 1500) : String(alternate.error)}`,
      );
      continue;
    }

    console.log(`  ${urns.length} page(s) administrée(s) :`);
    for (const urn of urns) {
      const id = organizationId(urn);
      let followers = "";
      if (id) {
        try {
          const size = await composio.tools.execute(FOLLOWERS, {
            userId,
            connectedAccountId: account.id,
            ...versionOptions,
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
