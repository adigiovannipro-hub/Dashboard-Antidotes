/**
 * Ce que le projet Composio Platform voit de Meta — lecture seule.
 *
 *   pnpm diagnostic:meta [--user <identifiant>]
 *   pnpm diagnostic:meta --sonde <idMédia,idPage,idCommentaire>
 *
 * Il répond à une question qu'on ne peut pas trancher en relisant du code :
 * **la Modération pourrait-elle passer par Composio là où l'API directe
 * refuse ?** La leçon LinkedIn est inscrite dans CLAUDE.md — un outil
 * pré-emballé n'est pas l'API, et la forme d'une réponse ne se relit pas, elle
 * se sonde. Une demi-journée de travail avait été jetée pour l'avoir oublié,
 * dans l'autre sens : on avait conclu à une limite de LinkedIn là où c'était
 * l'emballage qui bridait.
 *
 * Ce qu'il affiche, brut :
 *
 *   1. les configurations d'authentification disponibles pour les toolkits de
 *      la famille Meta, et **les portées qu'elles demandent** — c'est là que
 *      se joue tout le reste : `instagram_manage_comments`,
 *      `pages_messaging`, `pages_manage_engagement` ne s'obtiennent pas par
 *      une passerelle, elles s'obtiennent par une app Meta approuvée ;
 *   2. les comptes actifs **du projet**. Piège déjà payé sur LinkedIn :
 *      brancher depuis « All Apps » range le compte dans le tiroir personnel
 *      « For You », invisible du projet Platform que l'application interroge —
 *      trois connexions existaient, le projet en voyait zéro ;
 *   3. jusqu'où porte le passage brut (`tools.proxyExecute`) sur les quatre
 *      points d'entrée de la Modération : les commentaires d'un média, les
 *      conversations d'une Page, la réponse à un commentaire, l'envoi d'un
 *      message privé.
 *
 * **Rien n'est écrit.** Les deux sondes d'écriture visent l'objet `0`, qui
 * n'existe pas : Graph refuse sur l'objet, et c'est justement ce refus qui
 * prouve que la passerelle a bien porté la méthode POST et l'authentification.
 * Un refus de portée, lui, se lit tout autrement — et c'est la réponse
 * cherchée.
 *
 * À jouer depuis un runner GitHub (étape « Diagnostic Meta » du workflow
 * « Base de données ») : l'API Composio n'est pas joignable depuis
 * l'environnement de développement distant.
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

/**
 * Les slugs candidats. Composio range Meta sous plusieurs toolkits selon le
 * produit, et leurs noms ont changé : on les demande tous et on affiche ce qui
 * répond, plutôt que d'en supposer un et de conclure « rien » sur une faute de
 * frappe.
 */
const TOOLKITS = ["meta", "instagram", "facebook", "facebook_pages", "meta_ads"];

/** Ce qu'on montre d'une réponse : assez pour trancher, pas le roman entier. */
function show(value: unknown, max = 2500): string {
  try {
    return JSON.stringify(value).slice(0, max);
  } catch {
    return String(value);
  }
}

type Probe = {
  label: string;
  endpoint: string;
  method: "GET" | "POST";
  body?: Record<string, unknown>;
};

async function main() {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    console.error("COMPOSIO_API_KEY manquante — clé de projet Platform (ak_…).");
    process.exit(1);
  }

  const userId = argValue("user") ?? process.env.COMPOSIO_DEFAULT_USER_ID ?? "agence";
  /* Un seul argument pour trois identifiants : le workflow les transmet en une
     chaîne citée, ce qui évite d'interpoler du texte libre dans un `run:`. */
  const [mediaId, pageId, commentId] = (argValue("sonde") ?? "")
    .split(",")
    .map((part) => part.trim());
  const composio = new Composio({ apiKey });

  // --- 1. Configurations d'authentification et portées demandées -------------
  console.log("Configurations d'authentification");
  for (const toolkit of TOOLKITS) {
    let items: unknown[] = [];
    try {
      const configs = await composio.authConfigs.list({ toolkit });
      items = configs.items;
    } catch (error) {
      console.log(`  · ${toolkit} : refus — ${error instanceof Error ? error.message : error}`);
      continue;
    }

    if (items.length === 0) {
      console.log(`  · ${toolkit} : aucune`);
      continue;
    }
    console.log(`  · ${toolkit} : ${items.length}`);
    for (const config of items) {
      /* La fiche entière, et non les trois champs qu'on croit connaître : les
         portées vivent selon les versions dans `scopes`, `authScheme` ou
         `restrictToFollowingTools`, et c'est précisément ce qu'on vient
         vérifier. */
      console.log(`      ${show(config, 1800)}`);
    }
  }

  // --- 2. Comptes actifs du projet ------------------------------------------
  console.log("");
  console.log(`Comptes actifs du projet (interrogés sous « ${userId} »)`);
  const accounts: { id: string; toolkit: string }[] = [];
  for (const toolkit of TOOLKITS) {
    let items: { id: string; isDisabled?: boolean }[] = [];
    try {
      const listed = await composio.connectedAccounts.list({
        toolkitSlugs: [toolkit],
        statuses: ["ACTIVE"],
      });
      items = listed.items;
    } catch (error) {
      console.log(`  · ${toolkit} : refus — ${error instanceof Error ? error.message : error}`);
      continue;
    }

    const active = items.filter((item) => !item.isDisabled);
    console.log(`  · ${toolkit} : ${active.length}`);
    for (const account of active) {
      console.log(`      ${show(account, 1200)}`);
      accounts.push({ id: account.id, toolkit });
    }
  }

  if (accounts.length === 0) {
    console.log("");
    console.log("Aucun compte Meta connecté dans le projet Composio.");
    console.log("→ Si l'interface Composio en montre un, il est dans le tiroir personnel");
    console.log("  « For You » et non dans le projet Platform : c'est le piège déjà payé");
    console.log("  sur LinkedIn. Rebrancher depuis le projet, pas depuis « All Apps ».");
    return;
  }

  // --- 3. Portée du passage brut --------------------------------------------
  const probes: Probe[] = [
    {
      label: "Commentaires d'un média Instagram",
      endpoint: `/${mediaId || "0"}/comments?fields=id,text,timestamp,username,from{id,username,profile_picture_url}&limit=5`,
      method: "GET",
    },
    {
      label: "Conversations d'une Page (Messenger + DM Instagram)",
      endpoint: `/${pageId || "0"}/conversations?platform=instagram&limit=5`,
      method: "GET",
    },
    {
      /* Objet `0` : Graph refuse sur l'objet, rien n'est publié. Ce qu'on lit
         dans le refus est la seule chose qui compte — « does not exist » dit
         que la passerelle a porté l'appel authentifié, un refus de portée dit
         qu'elle n'aurait rien changé. */
      label: "Réponse à un commentaire — POST, objet inexistant, rien n'est écrit",
      endpoint: `/${commentId || "0"}/replies`,
      method: "POST",
      body: { message: "" },
    },
    {
      label: "Message privé — POST, objet inexistant, rien n'est écrit",
      endpoint: `/${pageId || "0"}/messages`,
      method: "POST",
      body: {},
    },
  ];

  for (const account of accounts) {
    console.log("");
    console.log(`── ${account.toolkit} / ${account.id}`);

    for (const probe of probes) {
      console.log("");
      console.log(`  ${probe.label}`);
      console.log(`  ${probe.method} ${probe.endpoint}`);
      try {
        const response = await composio.tools.proxyExecute({
          endpoint: probe.endpoint,
          method: probe.method,
          connectedAccountId: account.id,
          body: probe.body,
        });
        console.log(`  status ${response.status ?? "?"} — ${show(response.data)}`);
      } catch (error) {
        console.log(`  refus — ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  console.log("");
  console.log("Lecture du résultat :");
  console.log("  · un refus qui cite une **portée** (instagram_manage_comments,");
  console.log("    pages_messaging, pages_manage_engagement) vient de Meta, pas de");
  console.log("    l'emballage : Composio n'y changerait rien, il faudrait l'App Review.");
  console.log("  · un refus qui cite l'outil, la version ou l'absence de compte vient de");
  console.log("    la passerelle : là, le passage brut a quelque chose à apporter.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
