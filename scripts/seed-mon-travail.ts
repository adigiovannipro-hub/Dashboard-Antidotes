/**
 * Amorçage des données de démonstration de « Mon travail ».
 *
 *   pnpm seed:mon-travail          crée ou met à jour
 *   pnpm seed:mon-travail --reset  efface d'abord tout le module (tâches,
 *                                  cycles) et les trois espaces de démo
 *
 * Le jeu de données montre la page d'accueil en situation : trois clients de
 * démonstration avec des publications aujourd'hui à des statuts variés — en
 * plus de Bondet, dont le planning d'août tombe déjà sur le jour J et n'est
 * pas touché —, des tâches Fathom et mail simulées dont une datée d'hier (le
 * retard rouge), le cycle mensuel matérialisé.
 *
 * Les dates sont relatives au jour du lancement : rejouer le script recale la
 * démo sur aujourd'hui. Idempotent : identifiants dérivés de clés stables,
 * insertions réconciliées par id ou par clé d'idempotence — les statuts que
 * l'interface a modifiés (coche, suppression) sont conservés.
 */
import { createHash } from "node:crypto";

import dotenv from "dotenv";
import { Client } from "pg";

import { addDays, monthKeyOf, todayInParis } from "../src/lib/mon-travail/dates";
import {
  planCycleTasks,
  type CycleForPlanning,
} from "../src/lib/mon-travail/recurrence";
import { DEFAULT_CYCLE_STEPS } from "../src/lib/mon-travail/types";

dotenv.config({ path: ".env.local", quiet: true });

/** UUID stable dérivé d'une clé : rejouer l'amorçage ne recrée rien. */
function stableId(key: string): string {
  const hex = createHash("sha256").update(`mon-travail:${key}`).digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join("-");
}

// --- Espaces de démonstration ----------------------------------------------

type WorkspaceSeed = {
  slug: string;
  name: string;
  accent: string;
  lanes: LaneSeed[];
};

type LaneSeed = {
  platform: string;
  name: string;
  subjects: SubjectSeed[];
};

type SubjectSeed = {
  key: string;
  /** Décalage en jours par rapport à aujourd'hui. */
  offset: number;
  name: string;
  format: string;
  status: string;
  wording?: string;
  visual?: boolean;
  sponsoring?: number;
};

/* Les noms reprennent ceux de la facturation de démo du module Finance : un
   seul univers, pas deux jeux de personnages. */
const WORKSPACES: WorkspaceSeed[] = [
  {
    slug: "silmo-paris",
    name: "Silmo Paris",
    accent: "#007eb5",
    lanes: [
      {
        platform: "meta",
        name: "META",
        subjects: [
          {
            key: "silmo-recap",
            offset: 0,
            name: "RECAP EXPOSANTS J-60",
            format: "reel",
            status: "published",
            wording: "J-60 avant l'ouverture. Les exposants qui font le salon…",
            visual: true,
          },
          {
            key: "silmo-teasing",
            offset: 0,
            name: "TEASING CONFÉRENCES",
            format: "post",
            status: "scheduled",
            wording:
              "Le programme des conférences arrive. Trois plateaux, un fil rouge : la filière optique qui vient.",
            visual: true,
            sponsoring: 120,
          },
          {
            key: "silmo-badge",
            offset: 2,
            name: "OUVERTURE BADGES",
            format: "post",
            status: "validated",
          },
        ],
      },
      {
        platform: "linkedin",
        name: "LINKEDIN",
        subjects: [
          {
            key: "silmo-b2b",
            offset: 0,
            name: "PAROLE D'EXPOSANT — MOREL",
            format: "carousel",
            status: "to_validate",
            wording: "Trois questions à la maison Morel avant le salon.",
            visual: true,
          },
        ],
      },
    ],
  },
  {
    slug: "datack",
    name: "Datack",
    accent: "#ff6d3b",
    lanes: [
      {
        platform: "instagram",
        name: "INSTAGRAM",
        subjects: [
          {
            key: "datack-cas",
            offset: 0,
            name: "CAS CLIENT — MIGRATION GA4",
            format: "carousel",
            status: "published",
            wording: "De l'audit au premier dashboard : 6 semaines, pas une de plus.",
            visual: true,
          },
          {
            key: "datack-story",
            offset: 0,
            name: "STORY RECRUTEMENT",
            format: "story",
            status: "in_progress",
          },
          {
            key: "datack-reel",
            offset: 3,
            name: "REEL COULISSES SPRINT",
            format: "reel",
            status: "wording_todo",
          },
        ],
      },
    ],
  },
  {
    slug: "maison-perrin",
    name: "Maison Perrin",
    accent: "#784bd1",
    lanes: [
      {
        platform: "instagram",
        name: "INSTAGRAM",
        subjects: [
          {
            key: "perrin-collection",
            offset: 0,
            name: "LANCEMENT COLLECTION LIN",
            format: "post",
            status: "validated",
            wording: "Le lin lavé arrive en boutique. Teintes d'été, coupe droite.",
            visual: true,
            sponsoring: 80,
          },
          {
            key: "perrin-atelier",
            offset: 1,
            name: "VISITE D'ATELIER",
            format: "reel",
            status: "draft",
          },
        ],
      },
    ],
  },
];

// --- Tâches de démonstration ------------------------------------------------

type TaskSeed = {
  key: string;
  title: string;
  source: "manual" | "fathom" | "email";
  /** Décalage en jours par rapport à aujourd'hui. */
  offset: number;
  workspaceSlug?: string;
  done?: boolean;
  sourceLabel?: string;
  sourceUrl?: string;
};

const TASKS: TaskSeed[] = [
  // Fathom : extraites des sections todo des comptes rendus (simulées).
  {
    key: "fathom-silmo-grille",
    title: "Envoyer la nouvelle grille tarifaire sponsoring à Silmo",
    source: "fathom",
    offset: 1,
    workspaceSlug: "silmo-paris",
    sourceLabel: "Réunion mensuelle Silmo Paris — 3 août",
    sourceUrl: "https://fathom.video/calls/98431027",
  },
  {
    key: "fathom-perrin-moodboard",
    title: "Préparer le moodboard de la collection automne",
    source: "fathom",
    offset: 3,
    workspaceSlug: "maison-perrin",
    sourceLabel: "Point création Maison Perrin — 4 août",
    sourceUrl: "https://fathom.video/calls/98442615",
  },
  {
    key: "fathom-datack-devis",
    title: "Relancer le prestataire vidéo pour le devis tournage",
    source: "fathom",
    offset: -1,
    workspaceSlug: "datack",
    sourceLabel: "Sprint contenu Datack — 1er août",
    sourceUrl: "https://fathom.video/calls/98395502",
  },
  // Mails : uniquement ceux qui attendent une réponse (simulés).
  {
    key: "email-bondet-budget",
    title: "Répondre à Claire — budget du shooting de septembre",
    source: "email",
    offset: 0,
    workspaceSlug: "bondet",
    sourceLabel: "Mail du 4 août — « Re: Shooting septembre »",
  },
  {
    key: "email-rp-interview",
    title: "Répondre à l'agence RP — dates possibles pour l'interview",
    source: "email",
    offset: 0,
    workspaceSlug: "datack",
    sourceLabel: "Mail du 5 août — « Interview fondateur »",
  },
  // Manuelles.
  {
    key: "manuel-urssaf",
    title: "Payer l'échéance URSSAF",
    source: "manual",
    offset: 2,
  },
  {
    key: "manuel-portfolio",
    title: "Mettre à jour le portfolio avec les campagnes de juillet",
    source: "manual",
    offset: 4,
  },
  // De quoi remplir l'archivé.
  {
    key: "manuel-reporting-juillet",
    title: "Exporter le reporting de juillet et l'envoyer à Bondet",
    source: "manual",
    offset: -1,
    workspaceSlug: "bondet",
    done: true,
  },
  {
    key: "email-silmo-acces",
    title: "Répondre au régisseur — accès presse",
    source: "email",
    offset: 0,
    workspaceSlug: "silmo-paris",
    sourceLabel: "Mail du 2 août — « Accès presse »",
    done: true,
  },
];

const MONTH_LABELS = [
  "JANVIER",
  "FÉVRIER",
  "MARS",
  "AVRIL",
  "MAI",
  "JUIN",
  "JUILLET",
  "AOÛT",
  "SEPTEMBRE",
  "OCTOBRE",
  "NOVEMBRE",
  "DÉCEMBRE",
];

async function main() {
  const reset = process.argv.includes("--reset");
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error("SUPABASE_DB_URL absent de .env.local.");
    process.exit(1);
  }

  const db = new Client({
    connectionString,
    ssl: connectionString.includes("sslmode=disable")
      ? false
      : { rejectUnauthorized: false },
  });
  await db.connect();

  const today = todayInParis();
  const monthKey = monthKeyOf(today);
  const monthStart = `${monthKey}-01`;
  const year = Number(monthKey.slice(0, 4));
  const monthLabel = MONTH_LABELS[Number(monthKey.slice(5, 7)) - 1]!;

  try {
    const { rows: orgs } = await db.query<{ id: string }>(
      "select id from organizations order by created_at limit 1",
    );
    const orgId = orgs[0]?.id;
    if (!orgId) throw new Error("Aucune organisation — appliquer les migrations.");

    if (reset) {
      await db.query("delete from work_tasks where org_id = $1", [orgId]);
      await db.query("delete from work_cycles where org_id = $1", [orgId]);
      await db.query(
        "delete from workspaces where org_id = $1 and slug = any($2::text[])",
        [orgId, WORKSPACES.map((workspace) => workspace.slug)],
      );
      console.log("Module vidé, espaces de démonstration effacés.");
    }

    // --- Espaces, plannings, publications --------------------------------
    let publicationCount = 0;

    for (const seed of WORKSPACES) {
      const workspaceId = stableId(`workspace:${seed.slug}`);
      await db.query(
        `insert into workspaces (id, org_id, type, slug, name, accent_color)
         values ($1, $2, 'client', $3, $4, $5)
         on conflict (id) do update set name = excluded.name,
           accent_color = excluded.accent_color`,
        [workspaceId, orgId, seed.slug, seed.name, seed.accent],
      );

      const boardId = stableId(`board:${seed.slug}:${year}`);
      await db.query(
        `insert into planning_boards (id, workspace_id, kind, slug, name, year)
         values ($1, $2, 'editorial', $3, $4, $5)
         on conflict (id) do update set name = excluded.name`,
        [boardId, workspaceId, `pe-${year}`, `Planning Éditorial ${year}`, year],
      );

      const monthId = stableId(`month:${seed.slug}:${monthKey}`);
      await db.query(
        `insert into planning_months (id, board_id, workspace_id, label, month)
         values ($1, $2, $3, $4, $5)
         on conflict (id) do update set label = excluded.label`,
        [monthId, boardId, workspaceId, monthLabel, monthStart],
      );

      for (const [laneIndex, lane] of seed.lanes.entries()) {
        const laneId = stableId(`lane:${seed.slug}:${monthKey}:${lane.platform}`);
        await db.query(
          `insert into planning_lanes
             (id, month_id, board_id, workspace_id, platform, name, position)
           values ($1, $2, $3, $4, $5::planning_platform, $6, $7)
           on conflict (id) do update set name = excluded.name`,
          [laneId, monthId, boardId, workspaceId, lane.platform, lane.name, laneIndex],
        );

        for (const [index, subject] of lane.subjects.entries()) {
          await db.query(
            `insert into planning_subjects
               (id, lane_id, month_id, board_id, workspace_id, name, status,
                format, scheduled_on, wording, sponsoring, visual_urls, position)
             values ($1,$2,$3,$4,$5,$6,$7::planning_status,$8::planning_format,
                     $9,$10,$11,$12,$13)
             on conflict (id) do update set
               name = excluded.name,
               scheduled_on = excluded.scheduled_on,
               wording = excluded.wording`,
            [
              stableId(`subject:${subject.key}`),
              laneId,
              monthId,
              boardId,
              workspaceId,
              subject.name,
              subject.status,
              subject.format,
              addDays(today, subject.offset),
              subject.wording ?? null,
              subject.sponsoring ?? null,
              subject.visual
                ? [`https://picsum.photos/seed/${subject.key}/900/900`]
                : [],
              index,
            ],
          );
          publicationCount += 1;
        }
      }
    }

    // --- Cycles mensuels ---------------------------------------------------
    const { rows: clientWorkspaces } = await db.query<{ id: string; slug: string }>(
      "select id, slug from workspaces where org_id = $1 and type = 'client'",
      [orgId],
    );

    const cyclesForPlanning: CycleForPlanning[] = [];
    for (const workspace of clientWorkspaces) {
      /* `returning id` après un upsert sans effet : si un cycle existe déjà
         pour cet espace — créé à la main, autre id — c'est le sien que les
         étapes doivent référencer, pas celui que le seed aurait choisi. */
      const { rows: cycleRows } = await db.query<{ id: string }>(
        `insert into work_cycles (id, org_id, workspace_id, active)
         values ($1, $2, $3, true)
         on conflict (workspace_id) do update set workspace_id = excluded.workspace_id
         returning id`,
        [stableId(`cycle:${workspace.slug}`), orgId, workspace.id],
      );
      const cycleId = cycleRows[0]!.id;

      const steps: CycleForPlanning["steps"] = [];
      for (const [position, step] of DEFAULT_CYCLE_STEPS.entries()) {
        const stepId = stableId(`step:${workspace.slug}:${position}`);
        await db.query(
          `insert into work_cycle_steps
             (id, cycle_id, org_id, workspace_id, label, week_of_month, position)
           values ($1, $2, $3, $4, $5, $6, $7)
           on conflict (id) do update set label = excluded.label,
             week_of_month = excluded.week_of_month, position = excluded.position`,
          [stepId, cycleId, orgId, workspace.id, step.label, step.week, position],
        );
        steps.push({ id: stepId, label: step.label, week_of_month: step.week });
      }

      cyclesForPlanning.push({ workspace_id: workspace.id, steps });
    }

    // --- Occurrences générées : le travail que fera le cron ---------------
    // La ligne quotidienne fixe n'est plus semée : elle a quitté le dashboard,
    // et les lignes déjà en base y sont masquées à la lecture. Le retard rouge
    // de la démo vient désormais des tâches datées d'hier ci-dessous.
    const planned = planCycleTasks({ orgId, monthKey, cycles: cyclesForPlanning });

    let generatedCount = 0;
    for (const task of planned) {
      const { rowCount } = await db.query(
        `insert into work_tasks
           (id, org_id, workspace_id, cycle_step_id, title, source, due_date, dedupe_key)
         values ($1, $2, $3, $4, $5, 'recurring'::work_task_source, $6, $7)
         on conflict (org_id, dedupe_key) do nothing`,
        [
          stableId(`task:${task.dedupe_key}`),
          task.org_id,
          task.workspace_id,
          task.cycle_step_id,
          task.title,
          task.due_date,
          task.dedupe_key,
        ],
      );
      generatedCount += rowCount ?? 0;
    }


    // --- Tâches Fathom, mail et manuelles ----------------------------------
    const workspaceIdBySlug = new Map(
      clientWorkspaces.map((workspace) => [workspace.slug, workspace.id]),
    );

    for (const seed of TASKS) {
      const dueDate = addDays(today, seed.offset);
      await db.query(
        `insert into work_tasks
           (id, org_id, workspace_id, title, source, status, due_date, done_at,
            dedupe_key, source_url, source_label)
         values ($1, $2, $3, $4, $5::work_task_source, $6::work_task_status,
                 $7, $8, $9, $10, $11)
         on conflict (id) do update set
           title = excluded.title,
           due_date = excluded.due_date`,
        [
          stableId(`task:${seed.key}`),
          orgId,
          seed.workspaceSlug ? (workspaceIdBySlug.get(seed.workspaceSlug) ?? null) : null,
          seed.title,
          seed.source,
          seed.done ? "done" : "pending",
          dueDate,
          seed.done ? `${dueDate}T15:30:00Z` : null,
          seed.source === "manual" ? null : `${seed.source}:demo-${seed.key}`,
          seed.sourceUrl ?? null,
          seed.sourceLabel ?? null,
        ],
      );
    }

    console.log(`Espaces de démo     ${WORKSPACES.length}`);
    console.log(`Publications        ${publicationCount}`);
    console.log(`Cycles clients      ${cyclesForPlanning.length}`);
    console.log(`Occurrences créées  ${generatedCount} (sur ${planned.length} planifiées)`);
    console.log(`Tâches sources      ${TASKS.length}`);
    console.log("\nOuvrir / — la page d'accueil « Mon travail »");
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
