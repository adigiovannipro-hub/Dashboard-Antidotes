/**
 * Effacement des données de démonstration de la Modération.
 *
 *   pnpm purge:moderation-demo
 *
 * À lancer le jour où le relevé Meta prend le relais : les deux jeux
 * cohabitent sinon dans les mêmes tables, et l'inbox mêle des commentaires
 * inventés à de vrais commentaires clients sans rien signaler.
 *
 * Ce qui part se reconnaît à son **identifiant**, pas à sa date : le seed
 * dérive tous les siens d'un SHA-256 stable (`stableId`), à commencer par le
 * client de démonstration lui-même. Tout le reste — conversations, messages,
 * brouillons, FAQ, connexions — pend à ce client par `on delete cascade`.
 *
 * Ce qui **reste** volontairement : les clients de modération créés par le
 * relevé réel, y compris celui d'un espace qui porterait le même nom. La
 * démonstration est identifiée par son UUID, jamais par son slug — un client
 * réel nommé « bondet » n'a rien à craindre de ce script.
 *
 * Le script compte avant d'effacer et n'efface rien s'il ne trouve rien :
 * le rejouer est sans effet.
 */
import { createHash } from "node:crypto";

import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: ".env.local", quiet: true });

/** Le même dérivé que `seed-moderation.ts` — une seule règle, deux scripts. */
function stableId(key: string): string {
  const hex = createHash("sha256").update(key).digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join("-");
}

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error("SUPABASE_DB_URL absent de .env.local.");
    process.exit(1);
  }

  const demoClientId = stableId("moderation-client:bondet");
  const db = new Client({
    connectionString,
    ssl: connectionString.includes("sslmode=disable")
      ? false
      : { rejectUnauthorized: false },
  });
  await db.connect();

  try {
    const { rows } = await db.query<{
      name: string;
      conversations: string;
      faq: string;
    }>(
      `select c.name,
              (select count(*) from conversations where client_id = c.id) as conversations,
              (select count(*) from faq_entries where client_id = c.id) as faq
         from moderation_clients c
        where c.id = $1`,
      [demoClientId],
    );

    const demo = rows[0];
    if (!demo) {
      console.log("Aucune donnée de démonstration : rien à effacer.");
      return;
    }

    console.log(
      `Client de démonstration « ${demo.name} » : ${demo.conversations} conversation(s), ${demo.faq} entrée(s) FAQ.`,
    );

    // Le journal d'audit est immuable par trigger : il référence le client en
    // `on delete cascade`, ses lignes partent avec lui sans passer par un
    // `update` ni un `delete` direct.
    await db.query("delete from moderation_clients where id = $1", [demoClientId]);
    console.log("Effacé. Le relevé Meta reste seul en place.");
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
