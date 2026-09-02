/**
 * Ce que le projet Composio Platform voit de LinkedIn — lecture seule.
 *
 *   pnpm diagnostic:linkedin [--user <identifiant>] [--version 20250909_00]
 *   pnpm diagnostic:linkedin --sonde 1988476
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
const SHARE_STATS = "LINKEDIN_GET_SHARE_STATS";
const PAGE_STATS = "LINKEDIN_GET_ORG_PAGE_STATS";

/** L'identifiant numérique d'une organisation, depuis son URN. */
function organizationId(urn: string): string | null {
  const match = /^urn:li:organization:(\d+)$/.exec(urn);
  return match?.[1] ?? null;
}

type Page = { id: string; name: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Le nom lisible d'une organisation, quel que soit le champ qui le porte. */
function organizationName(org: Record<string, unknown>): string {
  const localized = org.localizedName;
  if (typeof localized === "string" && localized) return localized;
  const vanity = org.vanityName;
  if (typeof vanity === "string" && vanity) return vanity;
  const name = asRecord(org.name);
  const values = asRecord(name?.localized);
  const first = values ? Object.values(values)[0] : null;
  return typeof first === "string" && first ? first : "(sans nom)";
}

/**
 * Les pages d'une réponse de `LINKEDIN_GET_COMPANY_INFO`, quelle que soit sa
 * forme.
 *
 * Composio ne rend pas les ACL brutes de LinkedIn : il **résout** déjà
 * l'organisation et renvoie sa fiche — un objet à `id` numérique, pas un
 * `urn:li:organization:…`. Constaté au premier passage réel, sur une réponse
 * pleine que le parseur d'origine lisait comme vide, ce qui se serait conclu
 * par « ce compte n'administre aucune page ». Les trois formes sont donc
 * acceptées : une fiche seule, une liste de fiches, une liste d'ACL.
 */
function pagesOf(payload: unknown): Page[] {
  const root = asRecord(payload);
  if (!root) return [];

  const collect = (value: unknown): Page[] => {
    const org = asRecord(value);
    if (!org) return [];
    if (typeof org.id === "number" || typeof org.id === "string") {
      return [{ id: String(org.id), name: organizationName(org) }];
    }
    const urn = org.organization;
    if (typeof urn === "string") {
      const id = organizationId(urn);
      return id ? [{ id, name: "(nom non résolu)" }] : [];
    }
    return [];
  };

  const elements = root.elements;
  if (Array.isArray(elements)) return elements.flatMap(collect);
  return collect(root);
}

async function main() {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    console.error("COMPOSIO_API_KEY manquante — clé de projet Platform (ak_…).");
    process.exit(1);
  }

  const userId = argValue("user") ?? process.env.COMPOSIO_DEFAULT_USER_ID ?? "agence";
  const version = argValue("version");
  const probe = argValue("sonde");
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

    /* Composio ne rend pas la liste des ACL : il **résout** l'organisation et
       renvoie une fiche unique. Une seule page sortait donc, quel que soit
       `count` — ce qui se lirait « ce compte n'administre qu'une page » alors
       qu'il en administre peut-être dix. On avance donc par `start`, un rang à
       la fois, jusqu'à ce que LinkedIn ne rende plus rien ou rende un doublon.
       Plafond à 50 : au-delà, c'est une boucle, pas un client. */
    const pages: Page[] = [];
    const seen = new Set<string>();
    let refusal: string | null = null;
    let raw: unknown = null;

    for (let start = 0; start < 50; start += 1) {
      let response: { successful?: boolean; data?: unknown; error?: unknown };
      try {
        response = await composio.tools.execute(ORG_ACLS, {
          userId,
          connectedAccountId: account.id,
          ...versionOptions,
          arguments: { role: "ADMINISTRATOR", state: "APPROVED", count: 1, start },
        });
      } catch (error) {
        if (start === 0) refusal = error instanceof Error ? error.message : String(error);
        break;
      }

      if (!response.successful) {
        /* Un refus au premier rang est une vraie erreur ; aux suivants, c'est
           la fin de la liste — LinkedIn ne rend pas 200 sur un rang vide. */
        if (start === 0) refusal = String(response.error ?? "sans message");
        break;
      }

      if (start === 0) raw = response.data;
      const fresh = pagesOf(response.data).filter((page) => !seen.has(page.id));
      if (fresh.length === 0) break;
      for (const page of fresh) {
        seen.add(page.id);
        pages.push(page);
      }
    }

    if (refusal) {
      console.log(`  Refus LinkedIn : ${refusal}`);
      console.log("  → si le message cite r_organization_admin, la portée n'a pas été accordée :");
      console.log("    la configuration utilisée n'est pas « linkedin-pages », ou l'application");
      console.log("    OAuth n'est pas approuvée pour la Community Management API.");
      continue;
    }

    if (pages.length === 0) {
      /* Une liste vide se lit de deux façons : le compte n'administre
         vraiment rien, ou la réponse n'a pas la forme attendue. La montrer
         telle quelle tranche — c'est le seul moyen de ne pas conclure à tort
         que le client n'a pas de page. */
      console.log("  Aucune page lue. Réponse brute de LinkedIn :");
      console.log(`  ${JSON.stringify(raw).slice(0, 4000)}`);

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

    console.log(`  ${pages.length} page(s) administrée(s) :`);
    for (const page of pages) {
      let followers = "";
      try {
        const size = await composio.tools.execute(FOLLOWERS, {
          userId,
          connectedAccountId: account.id,
          ...versionOptions,
          arguments: { organization_id: page.id },
        });
        const count = (size.data as { firstDegreeSize?: number } | undefined)?.firstDegreeSize;
        if (typeof count === "number") followers = ` — ${count} abonnés`;
      } catch {
        /* Le nombre d'abonnés n'est qu'un confort : son absence ne doit pas
           masquer la page trouvée, qui est la réponse cherchée. */
      }
      console.log(`    · ${page.name} — urn:li:organization:${page.id}${followers}`);
    }

    /* La sonde : ce que LinkedIn rend vraiment, avant d'écrire un
       collecteur dessus. La forme d'une réponse ne se devine pas — la fiche
       d'organisation avait déjà démenti la structure attendue. */
    if (!probe) continue;

    const end = Date.now();
    const start = end - 14 * 86_400_000;
    const probes: [string, string, Record<string, unknown>][] = [
      ["Statistiques de publications — total", SHARE_STATS, {
        organizational_entity: `urn:li:organization:${probe}`,
      }],
      ["Statistiques de publications — par jour", SHARE_STATS, {
        organizational_entity: `urn:li:organization:${probe}`,
        time_intervals: `(timeRange:(start:${start},end:${end}),timeGranularityType:DAY)`,
      }],
      ["Statistiques de page — par jour", PAGE_STATS, {
        organization: `urn:li:organization:${probe}`,
        timeRangeStart: start,
        timeRangeEnd: end,
        timeGranularityType: "DAY",
      }],
    ];

    for (const [label, slug, args] of probes) {
      console.log("");
      console.log(`  ${label} :`);
      const result = await composio.tools.execute(slug, {
        userId,
        connectedAccountId: account.id,
        ...versionOptions,
        arguments: args,
      });
      console.log(
        `  ${result.successful ? JSON.stringify(result.data).slice(0, 3000) : String(result.error)}`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
