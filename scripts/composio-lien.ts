/**
 * Génère le lien de connexion d'un réseau dans le **projet Composio
 * Platform** — celui que la clé `ak_` de l'application interroge.
 *
 *   pnpm composio:lien --toolkit linkedin [--user <identifiant>] [--config <nom>] [--portees "a b c"]
 *
 * Toolkits servis : google_analytics, linkedin, youtube, tiktok. TikTok n'a
 * pas d'OAuth géré par Composio à ce jour — le lien échouera tant qu'une
 * app TikTok Developers n'aura pas été déclarée en credentials custom.
 *
 * Pourquoi ce script existe : Composio range les comptes dans deux tiroirs.
 * Brancher un compte depuis « All Apps » du tableau de bord alimente le
 * tiroir personnel (« For You ») — invisible du projet Platform, donc de
 * l'application. Ce script parle au bon tiroir, avec la clé du projet, et
 * rend une URL à ouvrir dans un navigateur : autoriser le compte là, et il
 * atterrit dans le projet.
 *
 * `toolkits.authorize` crée la configuration d'authentification du toolkit
 * si elle n'existe pas encore (OAuth géré par Composio) puis initie la
 * connexion : un seul appel, aucun réglage préalable dans le dashboard.
 * Se connecter avec le **compte pro** qui administre la page du client.
 *
 * L'identifiant d'utilisateur est celui sous lequel le compte sera rangé —
 * `docs/composio-setup.md` prescrit l'UUID de l'espace client. Tant qu'un
 * seul compte du toolkit vit dans le projet, le connecteur le prend même
 * sans identifiant exact, donc un libellé lisible suffit pour démarrer.
 *
 * **LinkedIn exige ses portées d'organisation.** La configuration gérée par
 * défaut ne demande que le profil et la publication personnelle : avec elle,
 * toute lecture d'une page entreprise répond 403 « r_organization_admin »
 * — vécu le 2 septembre 2026 sur les deux comptes connectés. Le script crée
 * donc, pour LinkedIn, une configuration **nommée** portant les portées de
 * la Community Management API, et c'est contre elle que le lien se demande.
 * Le nom et les portées se surchargent (`--config`, `--portees`) pour le
 * jour où LinkedIn en change.
 *
 * Variable requise : COMPOSIO_API_KEY (clé de projet, `ak_…`).
 */
import dotenv from "dotenv";
import { Composio } from "@composio/core";

dotenv.config({ path: ".env.local", quiet: true });

const TOOLKITS = ["google_analytics", "linkedin", "youtube", "tiktok"] as const;

/**
 * Les configurations à portées explicites, par toolkit. Absent = la
 * configuration gérée par défaut de Composio suffit.
 *
 * LinkedIn : lire les pages entreprise (abonnés, statistiques de page, de
 * publications) passe par la Community Management API et ses trois portées
 * `*_organization_*`. `w_member_social` reste pour publier ; `openid`,
 * `profile`, `email` identifient le compte qui autorise.
 */
const SCOPED_CONFIGS: Partial<Record<(typeof TOOLKITS)[number], { name: string; scopes: string[] }>> = {
  linkedin: {
    name: "linkedin-pages",
    scopes: [
      "openid",
      "profile",
      "email",
      "w_member_social",
      "r_organization_social",
      "r_organization_admin",
      "rw_organization_admin",
    ],
  },
};

function argValue(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : null;
}

async function main() {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    console.error(
      "Variable absente : COMPOSIO_API_KEY (clé de projet Platform, « ak_… »).",
    );
    process.exit(1);
  }

  const toolkit = argValue("toolkit") ?? "google_analytics";
  if (!(TOOLKITS as readonly string[]).includes(toolkit)) {
    console.error(`Toolkit inconnu : ${toolkit}. Servis : ${TOOLKITS.join(", ")}.`);
    process.exit(1);
  }

  const userId = argValue("user") ?? process.env.COMPOSIO_DEFAULT_USER_ID ?? "anmf";
  const composio = new Composio({ apiKey });

  // L'état du tiroir d'abord : si un compte actif est déjà là, le lien ne
  // sert à rien et le dire évite une autorisation pour rien.
  const existing = await composio.connectedAccounts.list({
    toolkitSlugs: [toolkit],
    statuses: ["ACTIVE"],
  });
  const active = existing.items.filter((item) => !item.isDisabled);
  if (active.length > 0) {
    console.log(
      `Le projet porte déjà ${active.length} compte(s) ${toolkit} actif(s) — rien à connecter.`,
    );
    for (const account of active) {
      console.log(`  · ${account.id}`);
    }
    console.log("Pour en connecter un de plus, passer --user avec un autre identifiant.");
  }

  /* Composio a fermé l'ancien chemin pour ses OAuth gérés (30/08/2026 :
     « Creating connections on this endpoint … is no longer supported », code
     600) : quand la configuration d'authentification existe déjà, le lien se
     demande à `connected_accounts/link`. `toolkits.authorize` ne reste que
     pour un toolkit jamais configuré, où il crée la configuration. */
  const configs = await composio.authConfigs.list({ toolkit });

  /* Une configuration à portées explicites se cherche **par son nom**, et se
     crée si elle manque : la configuration par défaut du même toolkit ne
     porte pas les bonnes portées, la réutiliser referait le 403. */
  const scoped = SCOPED_CONFIGS[toolkit as (typeof TOOLKITS)[number]];
  const configName = argValue("config") ?? scoped?.name ?? null;
  const scopes = argValue("portees")?.split(/[\s,]+/).filter(Boolean) ?? scoped?.scopes ?? null;

  let config = configName
    ? configs.items.find((item) => item.name === configName)
    : (configs.items.find((item) => item.status === "ENABLED") ?? configs.items[0]);

  if (!config && configName && scopes) {
    const created = await composio.authConfigs.create(toolkit, {
      type: "use_composio_managed_auth",
      name: configName,
      credentials: { scopes },
    });
    console.log(`Configuration « ${configName} » créée avec les portées : ${scopes.join(" ")}.`);
    config = { id: created.id, name: configName, status: "ENABLED" } as (typeof configs.items)[number];
  }

  const request = config
    ? await composio.connectedAccounts.link(userId, config.id)
    : await composio.toolkits.authorize(userId, toolkit);

  if (config) console.log(`Configuration utilisée : ${config.name ?? config.id}.`);

  console.log("");
  console.log(`Ouvrir ce lien dans un navigateur et autoriser le compte ${toolkit}`);
  console.log("du client — le compte pro qui administre la page :");
  console.log("");
  console.log(`  ${request.redirectUrl}`);
  console.log("");
  console.log(`Le compte sera rangé sous l'identifiant « ${userId} ».`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
