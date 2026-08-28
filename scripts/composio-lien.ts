/**
 * Génère le lien de connexion d'un réseau dans le **projet Composio
 * Platform** — celui que la clé `ak_` de l'application interroge.
 *
 *   pnpm composio:lien --toolkit linkedin [--user <identifiant>]
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
 * Variable requise : COMPOSIO_API_KEY (clé de projet, `ak_…`).
 */
import dotenv from "dotenv";
import { Composio } from "@composio/core";

dotenv.config({ path: ".env.local", quiet: true });

const TOOLKITS = ["google_analytics", "linkedin", "youtube", "tiktok"] as const;

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

  const request = await composio.toolkits.authorize(userId, toolkit);
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
