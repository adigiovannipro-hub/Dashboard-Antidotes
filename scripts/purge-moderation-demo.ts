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
 Deux cas, et c'est toute la difficulté : le relevé réel **adopte** un client
 * de démonstration qui porte le slug d'un espace (`ensureModerationClient`),
 * pour ne pas afficher deux « Bondet » dans l'inbox. Le client de démo devient
 * alors le client réel, et supprimer la ligne emporterait par cascade les
 * vraies conversations avec elle.
 *
 *   client jamais adopté (`workspace_id` nul)  → la ligne part, cascade comprise
 *   client adopté par un espace                → **seules les lignes du seed**
 *                                                partent, le client reste
 *
 * Les lignes du seed se reconnaissent à leur identifiant externe, comme dans
 * la purge Finance : `thread_<clé>` pour les conversations, `demo_<canal>_account`
 * pour les connexions, `story-<n>` pour les mentions. Les vraies portent des
 * identifiants Graph — des chiffres, parfois séparés d'un souligné, jamais ces
 * préfixes.
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
      workspace_id: string | null;
      demo_conversations: string;
      real_conversations: string;
      faq: string;
    }>(
      `select c.name,
              c.workspace_id,
              (select count(*) from conversations
                where client_id = c.id and external_thread_id like 'thread\_%') as demo_conversations,
              (select count(*) from conversations
                where client_id = c.id and external_thread_id not like 'thread\_%') as real_conversations,
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
      `Client « ${demo.name} » : ${demo.demo_conversations} conversation(s) de démonstration, ` +
        `${demo.real_conversations} réelle(s), ${demo.faq} entrée(s) FAQ.`,
    );

    if (!demo.workspace_id) {
      // Jamais adopté : la ligne n'a jamais servi qu'à la démonstration. Le
      // journal d'audit est immuable par trigger, mais il référence le client
      // en `on delete cascade` : ses lignes partent sans `update` ni `delete`.
      await db.query("delete from moderation_clients where id = $1", [demoClientId]);
      console.log("Client de démonstration effacé, contenu compris.");
      return;
    }

    // Adopté par un espace : le client est devenu le vrai. On ne retire que ce
    // que le seed avait posé, et la FAQ reste — elle a pu être corrigée à la
    // main depuis, et c'est elle qui alimente les brouillons.
    const { rowCount: purged } = await db.query(
      `delete from conversations
        where client_id = $1 and external_thread_id like 'thread\_%'`,
      [demoClientId],
    );
    const { rowCount: connections } = await db.query(
      `delete from channel_connections
        where client_id = $1 and external_account_id like 'demo\_%'`,
      [demoClientId],
    );
    const { rowCount: stories } = await db.query(
      `delete from story_mentions
        where client_id = $1 and external_id like 'story-%'`,
      [demoClientId],
    );

    console.log(
      `Ce client sert désormais un espace : seules les lignes du seed sont ` +
        `parties — ${purged ?? 0} conversation(s), ${connections ?? 0} connexion(s), ${stories ?? 0} mention(s). ` +
        `La FAQ et les conversations réelles restent.`,
    );
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
