/**
 * Amorçage du Planning Éditorial de Bondet.
 *
 *   pnpm seed:planning          crée ou met à jour
 *   pnpm seed:planning --reset  vide d'abord le tableau 2026
 *
 * Ce script pose la **structure** et les deux mois vivants — août en production,
 * septembre en préparation. Il ne recopie pas l'historique : pour reprendre une
 * année déjà saisie dans Monday, c'est `pnpm import:monday` qu'il faut lancer.
 *
 * Les captions des mois passés n'ont donc pas leur place ici. Ce qui est amorcé
 * se limite aux noms de sujets, aux dates et aux statuts — de quoi voir le
 * tableau vivre sans embarquer le contenu client dans le dépôt.
 *
 * Idempotent : réexécutable sans créer de doublon.
 */
import { createHash } from "node:crypto";

import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: ".env.local", quiet: true });

/** UUID stable dérivé d'une clé : rejouer l'amorçage ne recrée rien. */
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

type SeedSubject = {
  day: number;
  format: "post" | "story" | "reel" | "carousel" | "video" | "dark";
  name: string;
  status:
    | "idea"
    | "in_progress"
    | "wording_todo"
    | "to_validate"
    | "validated"
    | "scheduled"
    | "published";
  wording?: string;
  sponsoring?: number;
  adObjective?: string;
  adStatus?: "todo" | "doing" | "done";
};

type SeedLane = {
  platform: string;
  name: string;
  subjects: SeedSubject[];
};

type SeedMonth = { month: string; lanes: SeedLane[] };

/**
 * Août et septembre, tels qu'ils sont sur le board.
 *
 * Août est validé et attend ses dates ; septembre tourne autour du SILMO et
 * n'a encore ni visuel ni wording — c'est exactement l'état qu'un planning a
 * en cours de préparation, et ce que le contrôle de cadence doit savoir lire.
 */
const MONTHS: SeedMonth[] = [
  {
    month: "2026-08-01",
    lanes: [
      {
        platform: "meta",
        name: "META",
        subjects: [
          { day: 3, format: "post", name: "LIVRAISON OFFERTE", status: "validated" },
          {
            day: 5,
            format: "carousel",
            name: "ELIO COULEURS VERRES",
            status: "validated",
          },
          { day: 10, format: "reel", name: "MOMENTS BONDET 1", status: "validated" },
          { day: 12, format: "post", name: "JOY SOLAIRE SHOOT", status: "validated" },
          { day: 17, format: "reel", name: "MOMENTS BONDET 2", status: "validated" },
          {
            day: 19,
            format: "post",
            name: "FRANÇAISE ACCESSIBLE",
            status: "validated",
          },
        ],
      },
    ],
  },
  {
    month: "2026-09-01",
    lanes: [
      {
        platform: "meta",
        name: "META",
        subjects: [
          {
            day: 9,
            format: "post",
            name: "ANNONCE SILMO",
            status: "in_progress",
            wording: "NUMÉRO STAND ET INFO",
          },
          {
            day: 21,
            format: "carousel",
            name: "RELANCE SILMO J-7",
            status: "in_progress",
          },
          {
            day: 25,
            format: "reel",
            name: "RELANCE SILMO J-J",
            status: "in_progress",
          },
        ],
      },
    ],
  },
];

/** Quelques questions pour que le tableau FAQ ne s'ouvre pas vide. */
const FAQ = [
  {
    question: "Quels sont les délais de livraison ?",
    answer:
      "Nos commandes partent sous 24 h ouvrées et arrivent en 2 à 4 jours en France métropolitaine.",
    category: "Livraison",
  },
  {
    question: "Les montures sont-elles fabriquées en France ?",
    answer:
      "Oui, en matière biosourcée et avec la certification Origine France Garantie.",
    category: "Produit",
  },
  {
    question: "Comment retourner ou échanger une paire ?",
    answer:
      "Vous avez 30 jours. Le bon de retour se génère depuis votre espace commande, le renvoi est à notre charge.",
    category: "SAV & retours",
  },
];

async function main() {
  const reset = process.argv.includes("--reset");
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error("SUPABASE_DB_URL absent de .env.local.");
    process.exit(1);
  }

  const db = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await db.connect();

  try {
    const { rows: workspaces } = await db.query<{ id: string; org_id: string }>(
      "select id, org_id from workspaces where slug = 'bondet'",
    );
    const workspace = workspaces[0];
    if (!workspace) {
      throw new Error("Espace « bondet » introuvable — appliquer les migrations.");
    }

    // Le propriétaire par défaut des publications : l'owner de l'organisation.
    const { rows: owners } = await db.query<{ user_id: string }>(
      `select om.user_id
       from organization_members om
       join profiles p on p.id = om.user_id
       where om.org_id = $1 and om.role = 'owner'
       limit 1`,
      [workspace.org_id],
    );
    const ownerId = owners[0]?.user_id ?? null;

    const { rows: boards } = await db.query<{ id: string }>(
      "select id from planning_boards where workspace_id = $1 and slug = 'pe-2026'",
      [workspace.id],
    );
    const boardId = boards[0]?.id;
    if (!boardId) {
      throw new Error("Tableau « pe-2026 » introuvable — appliquer la migration 0008.");
    }

    if (reset) {
      await db.query(
        "delete from planning_lanes where board_id = $1",
        [boardId],
      );
      console.log("Couloirs et publications effacés.");
    }

    let count = 0;

    for (const month of MONTHS) {
      const { rows: monthRows } = await db.query<{ id: string }>(
        "select id from planning_months where board_id = $1 and month = $2",
        [boardId, month.month],
      );
      const monthId = monthRows[0]?.id;
      if (!monthId) {
        console.warn(`Mois ${month.month} absent du tableau, ignoré.`);
        continue;
      }

      for (const [laneIndex, lane] of month.lanes.entries()) {
        const laneId = stableId(`planning-lane:${month.month}:${lane.platform}`);
        await db.query(
          `insert into planning_lanes
             (id, month_id, board_id, workspace_id, platform, name, position)
           values ($1, $2, $3, $4, $5::planning_platform, $6, $7)
           on conflict (id) do update set name = excluded.name`,
          [
            laneId,
            monthId,
            boardId,
            workspace.id,
            lane.platform,
            lane.name,
            laneIndex,
          ],
        );

        for (const [index, subject] of lane.subjects.entries()) {
          await db.query(
            `insert into planning_subjects
               (id, lane_id, month_id, board_id, workspace_id, name, status,
                format, scheduled_on, wording, sponsoring, ad_objective,
                ad_status, owner_id, position)
             values ($1,$2,$3,$4,$5,$6,$7::planning_status,$8::planning_format,
                     $9,$10,$11,$12,$13::planning_ad_status,$14,$15)
             on conflict (id) do update set
               name = excluded.name,
               status = excluded.status,
               format = excluded.format,
               scheduled_on = excluded.scheduled_on,
               wording = excluded.wording`,
            [
              stableId(`planning-subject:${month.month}:${lane.platform}:${index}`),
              laneId,
              monthId,
              boardId,
              workspace.id,
              subject.name,
              subject.status,
              subject.format,
              `${month.month.slice(0, 7)}-${String(subject.day).padStart(2, "0")}`,
              subject.wording ?? null,
              subject.sponsoring ?? null,
              subject.adObjective ?? null,
              subject.adStatus ?? null,
              ownerId,
              index,
            ],
          );
          count += 1;
        }
      }
    }

    // --- FAQ ---
    const { rows: faqBoards } = await db.query<{ id: string }>(
      "select id from planning_boards where workspace_id = $1 and slug = 'faq'",
      [workspace.id],
    );
    const faqBoardId = faqBoards[0]?.id;

    if (faqBoardId) {
      for (const [index, entry] of FAQ.entries()) {
        await db.query(
          `insert into planning_faq_entries
             (id, board_id, workspace_id, question, answer, category, position, source)
           values ($1, $2, $3, $4, $5, $6, $7, 'manual')
           on conflict (id) do update set
             question = excluded.question,
             answer = excluded.answer`,
          [
            stableId(`planning-faq:${index}`),
            faqBoardId,
            workspace.id,
            entry.question,
            entry.answer,
            entry.category,
            index,
          ],
        );
      }
    }

    console.log(`Publications   ${count}`);
    console.log(`Entrées FAQ    ${faqBoardId ? FAQ.length : 0}`);
    console.log("\nOuvrir /espace/bondet/planning");
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
