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

function short(value: unknown, max = 900): string {
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
  console.log(`Compte : ${account.id} — organisation ${org}`);

  const entity = `urn%3Ali%3Aorganization%3A${org}`;

  /* Chaque essai est une hypothèse à confirmer ou à écarter. On les joue
     toutes : un refus est une information autant qu'un succès, et c'est le
     seul moyen de savoir quelle grandeur existe vraiment. */
  /* Version d'API vivante, trouvée au balayage du 2 septembre 2026 :
     LinkedIn n'en garde qu'une année, et 202512 était déjà morte quand
     202510 vivait encore — la fenêtre n'est pas un intervalle continu. */
  const VIVANTE = "202606";

  /* Les publications d'abord, pour lire leurs `content` : c'est là que
     vivent les URN de média, et il faut les résoudre pour avoir une
     vignette. Le tableau par publication n'en a aucune aujourd'hui. */
  const listing = await composio.tools.proxyExecute({
    endpoint: `/rest/posts?q=author&author=${entity}&count=8&sortBy=LAST_MODIFIED`,
    method: "GET",
    connectedAccountId: account.id,
    parameters: [
      { in: "header", name: "LinkedIn-Version", value: VIVANTE },
      { in: "header", name: "X-Restli-Protocol-Version", value: "2.0.0" },
    ],
  });

  const medias: string[] = [];
  const elements = (listing.data as { elements?: unknown[] } | undefined)?.elements ?? [];
  for (const element of elements) {
    const content = (element as { content?: Record<string, unknown> }).content;
    console.log(`   content : ${short(content, 300)}`);
    const id = (content?.media as { id?: string } | undefined)?.id;
    if (typeof id === "string") medias.push(id);
    const multi = content?.multiImage as { images?: { id?: string }[] } | undefined;
    for (const image of multi?.images ?? []) {
      if (typeof image.id === "string") medias.push(image.id);
    }
  }
  console.log("");
  console.log(`Médias trouvés : ${medias.join(" ")}`);

  const images = medias.filter((urn) => urn.startsWith("urn:li:image:"));
  const videos = medias.filter((urn) => urn.startsWith("urn:li:video:"));
  const documents = medias.filter((urn) => urn.startsWith("urn:li:document:"));

  const essais: { titre: string; endpoint: string; version?: string | null }[] = [];
  if (images.length > 0) {
    essais.push({
      titre: "Résolution d'images",
      endpoint: `/rest/images?ids=List(${images.slice(0, 3).map(encodeURIComponent).join(",")})`,
      version: VIVANTE,
    });
  }
  if (videos.length > 0) {
    essais.push({
      titre: "Résolution de vidéos",
      endpoint: `/rest/videos?ids=List(${videos.slice(0, 3).map(encodeURIComponent).join(",")})`,
      version: VIVANTE,
    });
  }
  if (documents.length > 0) {
    essais.push({
      titre: "Résolution de documents",
      endpoint: `/rest/documents?ids=List(${documents.slice(0, 3).map(encodeURIComponent).join(",")})`,
      version: VIVANTE,
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
