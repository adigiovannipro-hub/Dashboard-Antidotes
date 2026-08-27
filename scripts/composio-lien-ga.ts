/**
 * Génère le lien de connexion Google Analytics du **projet Composio Platform**
 * — celui que la clé `ak_` de l'application interroge.
 *
 *   pnpm composio:lien-ga [--user <identifiant>]
 *
 * Pourquoi ce script existe : Composio range les comptes dans deux tiroirs.
 * Brancher Google depuis « All Apps » du tableau de bord alimente le tiroir
 * personnel (« For You ») — invisible du projet Platform, donc de
 * l'application. Ce script parle au bon tiroir, avec la clé du projet, et
 * rend une URL à ouvrir dans un navigateur : autoriser Google là, et le
 * compte atterrit dans le projet.
 *
 * `toolkits.authorize` crée la configuration d'authentification du toolkit si
 * elle n'existe pas encore (OAuth géré par Composio) puis initie la
 * connexion : un seul appel, aucun réglage préalable dans le dashboard.
 *
 * L'identifiant d'utilisateur est celui sous lequel le compte sera rangé —
 * `docs/composio-setup.md` prescrit l'UUID de l'espace client. Tant qu'un
 * seul compte Google Analytics vit dans le projet, le connecteur le prend
 * même sans identifiant exact (`findGaConnectedAccountId`), donc un libellé
 * lisible suffit pour démarrer.
 *
 * Variable requise : COMPOSIO_API_KEY (clé de projet, `ak_…`).
 */
import dotenv from "dotenv";
import { Composio } from "@composio/core";

dotenv.config({ path: ".env.local", quiet: true });

const TOOLKIT = "google_analytics";

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

  const userId = argValue("user") ?? process.env.COMPOSIO_DEFAULT_USER_ID ?? "anmf";
  const composio = new Composio({ apiKey });

  // L'état du tiroir d'abord : si un compte actif est déjà là, le lien ne
  // sert à rien et le dire évite une autorisation Google pour rien.
  const existing = await composio.connectedAccounts.list({
    toolkitSlugs: [TOOLKIT],
    statuses: ["ACTIVE"],
  });
  const active = existing.items.filter((item) => !item.isDisabled);
  if (active.length > 0) {
    console.log(
      `Le projet porte déjà ${active.length} compte(s) Google Analytics actif(s) — rien à connecter.`,
    );
    for (const account of active) {
      console.log(`  · ${account.id}`);
    }
    return;
  }

  const request = await composio.toolkits.authorize(userId, TOOLKIT);
  console.log("");
  console.log("Ouvrir ce lien dans un navigateur et autoriser le compte Google");
  console.log("qui a accès à la propriété Analytics du client :");
  console.log("");
  console.log(`  ${request.redirectUrl}`);
  console.log("");
  console.log(
    `Le compte sera rangé sous l'identifiant « ${userId} ». Une fois autorisé,`,
  );
  console.log(
    "relancer la synchronisation depuis l'onglet Site Web (bouton Synchroniser).",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
