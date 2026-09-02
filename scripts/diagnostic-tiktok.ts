/**
 * Ce que le projet Composio Platform voit de TikTok — lecture seule.
 *
 *   pnpm diagnostic:tiktok [--user <identifiant>] [--brut]
 *
 * Écrit **avant** le connecteur, et pas l'inverse. La leçon de LinkedIn a
 * coûté une demi-journée : les outils pré-emballés de la passerelle ne
 * disent pas ce que l'API sait faire, et une conclusion tirée de leur seule
 * lecture était fausse de bout en bout. Ici on demande au service, on
 * regarde ce qu'il rend, et on décide après.
 *
 * Cinq questions, dans l'ordre où elles bloquent :
 *
 *   1. Une configuration d'authentification TikTok existe-t-elle dans le
 *      projet ? Composio ne gère pas l'OAuth TikTok pour nous : il faut une
 *      app TikTok Developers et ses portées. Sans configuration, rien ne
 *      peut être branché, et c'est le premier geste côté compte.
 *   2. Un compte est-il branché, et dans **ce** projet ? Les connexions
 *      faites depuis « All Apps » atterrissent dans le tiroir personnel,
 *      invisible du projet Platform — trois connexions LinkedIn existaient
 *      et le projet en voyait zéro.
 *   3. Que rend `TIKTOK_GET_USER_STATS` — abonnés, nombre de vidéos ?
 *   4. Que rend `TIKTOK_LIST_VIDEOS` — quels champs par vidéo, et sur
 *      quelle profondeur ?
 *   5. Le passage HTTP brut atteint-il l'API TikTok, et jusqu'où ?
 *      `open.tiktokapis.com` porte la Display API (les vidéos publiques du
 *      compte) ; `business.tiktokapis.com` porte la Business Account API,
 *      seule à rendre les vues de profil et les grandeurs au grain jour. Ce
 *      sont **deux hôtes**, et rien ne garantit que le proxy les atteigne
 *      tous les deux. C'est la question qui décide de la forme du
 *      connecteur, et elle ne se tranche pas en lisant la documentation.
 *
 * Variable requise : COMPOSIO_API_KEY (clé de projet Platform, `ak_…`).
 */
import dotenv from "dotenv";
import { Composio } from "@composio/core";

dotenv.config({ path: ".env.local", quiet: true });

const TOOLKIT = "tiktok";

function argValue(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

function short(value: unknown, max = 1200): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return (text ?? "").slice(0, max);
}

async function main() {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    console.error("COMPOSIO_API_KEY manquante — clé de projet Platform (ak_…).");
    process.exit(1);
  }

  const userId = argValue("user") ?? process.env.COMPOSIO_DEFAULT_USER_ID ?? "agence";
  const composio = new Composio({ apiKey });

  // --- 1. Les configurations d'authentification ---------------------------
  console.log("1. Configurations d'authentification TikTok du projet");
  try {
    const configs = await composio.authConfigs.list({ toolkit: TOOLKIT });
    if (configs.items.length === 0) {
      console.log(
        "   aucune — c'est le premier geste : créer une app TikTok Developers, " +
          "puis une configuration Composio avec sa clé et ses portées " +
          "(user.info.basic, user.info.stats, video.list).",
      );
    }
    for (const config of configs.items) {
      console.log(`   ${config.id} — ${config.name} (${config.authScheme ?? "schéma inconnu"}, ${config.status})`);
    }
  } catch (error) {
    console.log(`   échec : ${short(error instanceof Error ? error.message : error, 300)}`);
  }

  // --- 2. Les comptes branchés -------------------------------------------
  console.log("");
  console.log("2. Comptes TikTok actifs dans ce projet");
  const accounts = await composio.connectedAccounts.list({
    toolkitSlugs: [TOOLKIT],
    statuses: ["ACTIVE"],
  });
  const actifs = accounts.items.filter((item) => !item.isDisabled);
  if (actifs.length === 0) {
    console.log(
      "   aucun. Attention au tiroir : une connexion faite depuis « All Apps » " +
        "va dans l'espace personnel et reste invisible du projet Platform. " +
        "Passer par `pnpm composio:lien --toolkit tiktok`.",
    );
    return;
  }
  for (const account of actifs) {
    console.log(`   ${account.id} — ${account.toolkit?.slug ?? TOOLKIT}`);
  }

  const account = actifs[0]!;
  const version = argValue("version") ?? "latest";
  const outil = async (slug: string, args: Record<string, unknown>) => {
    const result = await composio.tools.execute(slug, {
      userId,
      connectedAccountId: account.id,
      version,
      dangerouslySkipVersionCheck: version === "latest",
      arguments: args,
    });
    if (!result.successful) throw new Error(short(result.error ?? "sans détail", 400));
    return result.data;
  };

  // --- 3. Le compte ------------------------------------------------------
  console.log("");
  console.log("3. TIKTOK_GET_USER_STATS");
  try {
    const data = await outil("TIKTOK_GET_USER_STATS", {
      fields: [
        "follower_count",
        "following_count",
        "likes_count",
        "video_count",
        "display_name",
        "username",
      ],
    });
    console.log(`   ${short(data)}`);
  } catch (error) {
    console.log(`   échec : ${short(error instanceof Error ? error.message : error, 400)}`);
  }

  // --- 4. Les vidéos -----------------------------------------------------
  console.log("");
  console.log("4. TIKTOK_LIST_VIDEOS (une page)");
  try {
    const data = await outil("TIKTOK_LIST_VIDEOS", { max_count: 20 });
    console.log(`   ${short(data, 2000)}`);
  } catch (error) {
    console.log(`   échec : ${short(error instanceof Error ? error.message : error, 400)}`);
  }

  // --- 5. Le passage brut, et jusqu'où il porte ---------------------------
  console.log("");
  console.log("5. Passage HTTP brut");
  const essais: [string, string, "GET" | "POST", Record<string, unknown> | undefined][] = [
    [
      "Display API — profil",
      "/v2/user/info/?fields=open_id,display_name,follower_count,video_count,likes_count",
      "GET",
      undefined,
    ],
    [
      "Display API — vidéos et leurs compteurs",
      "/v2/video/list/?fields=id,create_time,title,video_description,cover_image_url,share_url,duration,view_count,like_count,comment_count,share_count",
      "POST",
      { max_count: 20 },
    ],
    [
      "Business API — un autre hôte, la seule à rendre les vues de profil",
      "https://business.tiktokapis.com/open_api/v1.3/business/get/?business_id=BUSINESS_ID&fields=%5B%22followers_count%22%2C%22profile_views%22%5D",
      "GET",
      undefined,
    ],
  ];

  for (const [titre, endpoint, method, body] of essais) {
    try {
      const response = await composio.tools.proxyExecute({
        endpoint,
        method,
        connectedAccountId: account.id,
        ...(body ? { body } : {}),
      });
      console.log(`   ${titre} → ${response.status}`);
      console.log(`     ${short(response.data, 1500)}`);
    } catch (error) {
      console.log(
        `   ${titre} → échec ${short(error instanceof Error ? error.message : error, 300)}`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
