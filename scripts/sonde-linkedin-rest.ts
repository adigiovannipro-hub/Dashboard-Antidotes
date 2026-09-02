/**
 * Sonde l'API REST de LinkedIn **en direct**, par le passage brut de
 * Composio (`tools.proxyExecute`), et non par ses outils pré-emballés.
 *
 *   pnpm sonde:linkedin --organisation 1988476
 *
 * Pourquoi : `LINKEDIN_GET_SHARE_STATS` refuse tout `timeIntervals`, et
 * aucun outil n'expose les publications d'une page. Ce ne sont pas des
 * limites de LinkedIn — l'API sert les deux — mais des limites de
 * l'emballage. Le passage brut rend la main sur l'URL, les en-têtes
 * (`LinkedIn-Version`, `X-Restli-Protocol-Version`) et la syntaxe RestLi.
 *
 * Lecture seule. À jouer depuis un runner GitHub : l'API Composio n'est pas
 * joignable depuis l'environnement de développement distant.
 */
import dotenv from "dotenv";
import { Composio } from "@composio/core";

dotenv.config({ path: ".env.local", quiet: true });

const TOOLKIT = "linkedin";

function argValue(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

/** Minuit UTC il y a `daysAgo` jours, en millisecondes. */
function midnight(daysAgo: number): number {
  const day = new Date(Date.now() - daysAgo * 86_400_000);
  return Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
}

/** Le 1er du mois, il y a `monthsAgo` mois, en millisecondes UTC. */
function monthStart(monthsAgo: number): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1);
}

function short(value: unknown, max = 2500): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return (text ?? "").slice(0, max);
}

async function main() {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    console.error("COMPOSIO_API_KEY manquante — clé de projet Platform (ak_…).");
    process.exit(1);
  }

  const org = argValue("organisation") ?? "1988476";
  const version = argValue("version-linkedin") ?? "202508";
  const composio = new Composio({ apiKey });

  const accounts = await composio.connectedAccounts.list({
    toolkitSlugs: [TOOLKIT],
    statuses: ["ACTIVE"],
  });
  const account = accounts.items.filter((item) => !item.isDisabled)[0];
  if (!account) {
    console.error("Aucun compte LinkedIn actif dans le projet Composio.");
    process.exit(1);
  }
  console.log(`Compte : ${account.id} — organisation ${org} (version par défaut ${version})`);

  const entity = `urn%3Ali%3Aorganization%3A${org}`;
  const debutMois = monthStart(13);
  const finMois = monthStart(0);
  const intervalleMois = `(timeRange:(start:${debutMois},end:${finMois}),timeGranularityType:MONTH)`;
  const intervalleJours = `(timeRange:(start:${midnight(30)},end:${midnight(0)}),timeGranularityType:DAY)`;

  /* Chaque essai est une hypothèse à confirmer ou à écarter. On les joue
     toutes : un refus est une information autant qu'un succès, et c'est le
     seul moyen de savoir quelle grandeur existe vraiment. */
  const essais: { titre: string; endpoint: string; version?: string | null }[] = [
    {
      titre: "v2 — publications par MOIS (13 mois, count explicite)",
      endpoint: `/v2/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${entity}&timeIntervals=${intervalleMois}&count=50`,
      version: null,
    },
    {
      titre: "v2 — publications par JOUR (30 jours)",
      endpoint: `/v2/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${entity}&timeIntervals=${intervalleJours}&count=50`,
      version: null,
    },
    {
      titre: "v2 — abonnés par MOIS (gains, pas cumul)",
      endpoint: `/v2/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=${entity}&timeIntervals=${intervalleMois}&count=50`,
      version: null,
    },
    {
      titre: "v2 — publications de la page (ugcPosts)",
      endpoint: `/v2/ugcPosts?q=authors&authors=List(${entity})&count=5&sortBy=LAST_MODIFIED`,
      version: null,
    },
    {
      titre: "v2 — partages de la page (shares)",
      endpoint: `/v2/shares?q=owners&owners=${entity}&count=5&sortBy=LAST_MODIFIED`,
      version: null,
    },
  ];

  /* Les `/rest/` refusent toutes sur « version 20250801 non active » :
     Composio pose lui-même l'en-tête `LinkedIn-Version` à partir de ce
     qu'on lui donne, et LinkedIn ne garde qu'une année de versions. On
     balaie les mois plausibles jusqu'à en trouver une vivante — c'est elle
     qui ouvre `/rest/posts`, la seule route qui liste les publications. */
  for (const mois of ["202609", "202608", "202606", "202603", "202601", "202512", "202510"]) {
    essais.push({
      titre: `/rest/posts avec LinkedIn-Version ${mois}`,
      endpoint: `/rest/posts?q=author&author=${entity}&count=3&sortBy=LAST_MODIFIED`,
      version: mois,
    });
  }

  for (const essai of essais) {
    console.log("");
    console.log(`── ${essai.titre}`);
    console.log(`   ${essai.endpoint.slice(0, 200)}`);
    try {
      const response = await composio.tools.proxyExecute({
        endpoint: essai.endpoint,
        method: "GET",
        connectedAccountId: account.id,
        parameters: essai.version
          ? [
              { in: "header", name: "LinkedIn-Version", value: essai.version },
              { in: "header", name: "X-Restli-Protocol-Version", value: "2.0.0" },
            ]
          : [{ in: "header", name: "X-Restli-Protocol-Version", value: "2.0.0" }],
      });
      console.log(`   status ${response.status}`);
      console.log(`   ${short(response.data)}`);
    } catch (error) {
      console.log(`   échec : ${short(error instanceof Error ? error.message : error, 800)}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
