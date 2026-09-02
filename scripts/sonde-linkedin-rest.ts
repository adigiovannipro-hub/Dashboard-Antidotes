/**
 * Sonde l'API LinkedIn **en direct**, par le passage HTTP brut de Composio.
 *
 *   pnpm sonde:linkedin --organisation 1988476 --mois 2026-08
 *
 * Elle répond à une seule question à la fois, et sur pièce. Ici : d'où
 * viennent les chiffres d'un mois. Le rapport Looker du client affiche
 * 3 722 impressions sur août quand la statistique de page en rend 36 903 —
 * ce ne sont pas les mêmes grandeurs, et il faut savoir laquelle est
 * laquelle avant de choisir ce que l'écran montre.
 *
 * Lecture seule. À jouer depuis un runner GitHub : l'API Composio n'est pas
 * joignable depuis l'environnement de développement distant.
 */
import dotenv from "dotenv";
import { Composio } from "@composio/core";

dotenv.config({ path: ".env.local", quiet: true });

const TOOLKIT = "linkedin";
const VIVANTE = process.env.LINKEDIN_API_VERSION ?? "202606";

function argValue(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

function short(value: unknown, max = 900): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return (text ?? "").slice(0, max);
}

type Stats = {
  impressionCount?: number;
  uniqueImpressionsCount?: number;
  clickCount?: number;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
};

function ligne(titre: string, stats: Stats | undefined) {
  if (!stats) return console.log(`  ${titre} : rien`);
  console.log(
    `  ${titre} : ${stats.impressionCount ?? 0} impressions, ${stats.uniqueImpressionsCount ?? 0} portée, ${stats.clickCount ?? 0} clics, ${stats.likeCount ?? 0} likes, ${stats.commentCount ?? 0} commentaires, ${stats.shareCount ?? 0} partages`,
  );
}

async function main() {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    console.error("COMPOSIO_API_KEY manquante — clé de projet Platform (ak_…).");
    process.exit(1);
  }

  const org = argValue("organisation") ?? "1988476";
  const mois = argValue("mois") ?? "2026-08";
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

  const entity = `urn%3Ali%3Aorganization%3A${org}`;
  const debut = Date.parse(`${mois}-01T00:00:00Z`);
  const fin = Date.UTC(
    Number(mois.slice(0, 4)),
    Number(mois.slice(5, 7)),
    1,
  );
  const intervalle = (grain: "DAY" | "MONTH") =>
    `(timeRange:(start:${debut},end:${fin}),timeGranularityType:${grain})`;

  console.log(`Compte ${account.id} — organisation ${org} — mois ${mois}`);

  const appel = async (endpoint: string, version: string | null = VIVANTE) => {
    const response = await composio.tools.proxyExecute({
      endpoint,
      method: "GET",
      connectedAccountId: account.id,
      parameters: version
        ? [
            { in: "header", name: "LinkedIn-Version", value: version },
            { in: "header", name: "X-Restli-Protocol-Version", value: "2.0.0" },
          ]
        : [{ in: "header", name: "X-Restli-Protocol-Version", value: "2.0.0" }],
    });
    if (Number(response.status ?? 0) >= 400) {
      throw new Error(`${response.status} ${short(response.data, 300)}`);
    }
    return response.data as { elements?: Record<string, unknown>[] };
  };

  // --- A. La page, en un mois --------------------------------------------
  console.log("");
  console.log("A. Statistiques de PAGE sur le mois");
  const pageMois = await appel(
    `/v2/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${entity}&timeIntervals=${intervalle("MONTH")}&count=50`,
    null,
  );
  for (const element of pageMois.elements ?? []) {
    ligne("mois", element.totalShareStatistics as Stats);
  }

  // --- B. Les publications parues dans le mois ---------------------------
  console.log("");
  console.log("B. Publications PARUES dans le mois");
  const urns: string[] = [];
  const dates = new Map<string, string>();
  for (let start = 0; start < 300; start += 50) {
    const page = await appel(
      `/rest/posts?q=author&author=${entity}&count=50&start=${start}&sortBy=LAST_MODIFIED`,
    );
    const elements = page.elements ?? [];
    if (elements.length === 0) break;
    let plusVieux = false;
    for (const element of elements) {
      const publishedAt = element.publishedAt ?? element.createdAt;
      const urn = element.id;
      if (typeof publishedAt !== "number" || typeof urn !== "string") continue;
      const jour = new Date(publishedAt).toISOString().slice(0, 10);
      if (jour < `${mois}-01`) plusVieux = true;
      if (jour.startsWith(mois) && element.lifecycleState === "PUBLISHED") {
        urns.push(urn);
        dates.set(urn, jour);
      }
    }
    if (plusVieux) break;
  }
  console.log(`  ${urns.length} publication(s) : ${[...dates.values()].sort().join(" ")}`);

  // --- C. Leurs statistiques, une à une ----------------------------------
  console.log("");
  console.log("C. Statistiques PAR PUBLICATION, et leur somme");
  const total: Required<Stats> = {
    impressionCount: 0,
    uniqueImpressionsCount: 0,
    clickCount: 0,
    likeCount: 0,
    commentCount: 0,
    shareCount: 0,
  };
  const familles: [string, string[]][] = [
    ["ugcPosts", urns.filter((urn) => urn.startsWith("urn:li:ugcPost:"))],
    ["shares", urns.filter((urn) => urn.startsWith("urn:li:share:"))],
  ];
  for (const [parametre, liste] of familles) {
    for (let index = 0; index < liste.length; index += 20) {
      const lot = liste.slice(index, index + 20);
      const data = await appel(
        `/rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${entity}&${parametre}=List(${lot.map(encodeURIComponent).join(",")})`,
      );
      for (const element of data.elements ?? []) {
        const stats = element.totalShareStatistics as Stats;
        const urn = (element.ugcPost ?? element.share) as string;
        console.log(`    ${dates.get(urn) ?? "?"} ${urn.slice(-12)} → ${stats?.impressionCount ?? 0} impressions, ${stats?.clickCount ?? 0} clics, ${stats?.likeCount ?? 0} likes`);
        for (const clef of Object.keys(total) as (keyof Stats)[]) {
          total[clef] += Math.max(0, Number(stats?.[clef] ?? 0));
        }
      }
    }
  }
  ligne("SOMME des publications du mois", total);

  // --- D. Les vues de page ------------------------------------------------
  console.log("");
  console.log("D. Vues de la page (organic / jobs)");
  try {
    const pages = await appel(
      `/rest/organizationPageStatistics?q=organization&organization=${entity}&timeIntervals=${intervalle("MONTH")}`,
    );
    console.log(`  ${short(pages, 1200)}`);
  } catch (error) {
    console.log(`  échec : ${short(error instanceof Error ? error.message : error, 400)}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
