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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
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
  //
  // Le grain compte autant que le chiffre : si la page rend le JOUR, les vues
  // se rangent dans `social_page_daily` comme le reste et se somment sur
  // n'importe quelle plage. Si elle ne rend que le MOIS, il faudra une
  // exception, et mieux vaut le savoir avant d'écrire la migration.
  for (const grain of ["DAY", "MONTH"] as const) {
    try {
      const pages = await appel(
        `/rest/organizationPageStatistics?q=organization&organization=${entity}&timeIntervals=${intervalle(grain)}`,
      );
      const elements = pages.elements ?? [];
      console.log(`  ${grain} : ${elements.length} élément(s)`);
      for (const element of elements.slice(0, 3)) {
        const range = asRecord(element.timeRange);
        const views = asRecord(asRecord(element.totalPageStatistics)?.views);
        const compte = (clef: string) => {
          const bloc = asRecord(views?.[clef]);
          return `${bloc?.pageViews ?? "—"}/${bloc?.uniquePageViews ?? "—"}`;
        };
        const debutRange = range?.start;
        const jour =
          typeof debutRange === "number"
            ? new Date(debutRange).toISOString().slice(0, 10)
            : "(sans intervalle)";
        console.log(
          `    ${jour} → toutes ${compte("allPageViews")}, accueil ${compte("overviewPageViews")}, emplois ${compte("jobsPageViews")}, carrières ${compte("careersPageViews")}`,
        );
      }
      if (elements.length === 0) console.log(`    ${short(pages, 400)}`);
    } catch (error) {
      console.log(`  ${grain} : échec ${short(error instanceof Error ? error.message : error, 300)}`);
    }
  }

  // --- E. Les autres pages du compte, sur le même mois --------------------
  //
  // Le rapport du client peut tout simplement porter sur une AUTRE page :
  // le compte connecté en administre six. Une seule des six rendra les
  // chiffres du Looker — et si aucune ne les rend, c'est que la grandeur
  // affichée là-bas n'est pas celle-ci.
  console.log("");
  console.log("E. Toutes les pages administrées, sur le même mois");
  try {
    const acls = await appel(
      "/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&count=50",
      null,
    );
    const ids = new Set<string>();
    for (const element of acls.elements ?? []) {
      const urn = element.organization ?? element.organizationalTarget;
      const match = typeof urn === "string" ? /(\d+)$/.exec(urn) : null;
      if (match) ids.add(match[1]);
    }
    if (ids.size === 0) console.log(`  aucune ACL lisible : ${short(acls, 400)}`);
    for (const id of ids) {
      const cible = `urn%3Ali%3Aorganization%3A${id}`;
      let nom = id;
      try {
        const fiche = await appel(`/v2/organizations/${id}`, null);
        const localized = (fiche as Record<string, unknown>).localizedName;
        if (typeof localized === "string" && localized) nom = `${localized} (${id})`;
      } catch {
        /* le nom n'est pas l'objet de la sonde */
      }
      try {
        const stats = await appel(
          `/v2/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${cible}&timeIntervals=${intervalle("MONTH")}&count=50`,
          null,
        );
        const premier = (stats.elements ?? [])[0];
        ligne(nom, premier?.totalShareStatistics as Stats);
      } catch (error) {
        console.log(`  ${nom} : échec ${short(error instanceof Error ? error.message : error, 200)}`);
      }
    }
  } catch (error) {
    console.log(`  échec : ${short(error instanceof Error ? error.message : error, 400)}`);
  }

  // --- F. Le même mois, un an plus tôt ------------------------------------
  //
  // Un rapport ouvert sur « 1 - 31 août » peut viser l'année précédente.
  console.log("");
  console.log("F. Le même mois de l'année précédente");
  try {
    const annee = Number(mois.slice(0, 4)) - 1;
    const debutPrecedent = Date.UTC(annee, Number(mois.slice(5, 7)) - 1, 1);
    const finPrecedent = Date.UTC(annee, Number(mois.slice(5, 7)), 1);
    const stats = await appel(
      `/v2/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${entity}&timeIntervals=(timeRange:(start:${debutPrecedent},end:${finPrecedent}),timeGranularityType:MONTH)&count=50`,
      null,
    );
    for (const element of stats.elements ?? []) {
      ligne(`${annee}-${mois.slice(5, 7)}`, element.totalShareStatistics as Stats);
    }
  } catch (error) {
    console.log(`  échec : ${short(error instanceof Error ? error.message : error, 400)}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
