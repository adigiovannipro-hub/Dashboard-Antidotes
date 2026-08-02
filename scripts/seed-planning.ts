/**
 * Amorçage des données de démonstration du module Planning Édito.
 *
 *   pnpm seed:planning          crée ou met à jour
 *   pnpm seed:planning --reset  efface d'abord les données du client de démo
 *
 * Le jeu reproduit la **structure** réelle des boards PE — board par client et
 * par année, groupe par mois, élément parent par plateforme, sous-élément par
 * contenu, et jusqu'aux identifiants de colonne (`texte5`, `dup__of_status`) —
 * avec un contenu inventé. Aucune caption d'un vrai client n'atterrit dans le
 * dépôt.
 *
 * Sept mois : cinq mois complets qui donnent sa matière à la déduction de
 * stratégie, le mois en cours avec ses manques de production, et le mois
 * suivant volontairement mal cadencé pour que le contrôle ait quelque chose à
 * dire. Idempotent : réexécutable sans créer de doublon.
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

// --- Structure du board -----------------------------------------------------

/** Identifiants de colonne réellement observés sur les boards PE. */
const COLUMN_MAPPING = {
  status: "status",
  format: "dup__of_status",
  date: "date0",
  wording: "texte5",
  comments: null,
  sponsoring: "chiffres",
  objective: "statut",
  owner: "person",
  visual: "fichier",
};

const STATUS_RAW: Record<string, string> = {
  published: "PUBLIÉ",
  validated: "VALIDÉ",
  to_validate: "À VALIDER",
  scheduled: "PROGRAMMÉ",
  in_progress: "EN COURS",
  wording_todo: "WORDING À FAIRE",
  draft: "EN BROUILLON",
  on_hold: "EN ATTENTE",
  idea: "",
  dropped: "NON RETENU",
};

const FORMAT_RAW: Record<string, string> = {
  post: "POST",
  reel: "REELS",
  story: "STORIE",
  carousel: "CARROUSEL",
  dark: "DARK",
};

// --- Contenus ---------------------------------------------------------------

type SeedSubject = {
  day: number | null;
  format: keyof typeof FORMAT_RAW;
  name: string;
  status: keyof typeof STATUS_RAW;
  /** `undefined` = caption générée depuis le template ; `null` = colonne vide. */
  wording?: string | null;
  pending?: string;
  visuals?: number;
  sponsoring?: number;
  objective?: string;
};

type SeedLane = { platform: string; name: string; subjects: SeedSubject[] };
type SeedMonth = { label: string; month: string; lanes: SeedLane[] };

/** Captions par template, dans le registre de la marque. Inventées. */
const CAPTIONS: Record<string, string> = {
  "MODÈLE DU MOIS":
    "Une monture qu'on met le matin et qu'on oublie jusqu'au soir. C'est tout ce qu'on demande à une bonne paire.\n\nDécouvrez le modèle du mois en bio.",
  "SAVOIR-FAIRE ATELIER":
    "Trois générations dans le même atelier, et toujours les mêmes gestes pour ajuster une charnière. Rien n'a changé dans l'essentiel.\n\nNotre histoire est en bio.",
  "ORIGINE FRANCE":
    "Ce qui ne se voit pas au premier regard est souvent ce qui compte le plus : matière biosourcée, fabrication certifiée en France.\n\nToute la collection en bio.",
  "PRIX ACCESSIBLE":
    "Fabriquées en France, en matière biosourcée, à partir de 59 €. On nous demande souvent où est le piège. Il n'y en a pas.\n\nEnregistrez ce post, vous y repenserez au moment de changer de paire.",
  "NOUVEAUTÉ SOLAIRE":
    "Le soleil ne prévient pas. Les bonnes solaires, si.\n\nLa nouvelle venue vous attend en bio.",
  "COULEURS DE VERRES":
    "Une même monture, plusieurs personnalités. Montures et verres se déclinent, à vous de composer la vôtre.\n\nDites-nous en commentaire la combinaison que vous choisiriez.",
  "COULISSES ATELIER":
    "Une journée à l'atelier, en trois plans. Le reste se passe entre les mains.",
  "MOMENTS BONDET":
    "Une paire, et tout ce qu'il y a autour : les trajets, les pauses, les silences. C'est ça, des lunettes pour la vie.\n\nPartagez ce reel à quelqu'un qui s'y reconnaîtra.",
  "LIVRAISON OFFERTE":
    "Tout le mois, la livraison est offerte. Une bonne raison de craquer pour la paire que vous repoussez depuis le début de l'été.",
  "DATA":
    "72 % des porteurs de lunettes ignorent où leur monture a été fabriquée.\n\nC'est un angle mort du marché, et une opportunité pour les opticiens qui savent en parler.\n\n→ Notre dossier complet est en premier commentaire.",
  "CARROUSEL USP":
    "Slide 1 — H1 : Trois promesses, aucune concession\nSlide 2 — Fabrication française certifiée\nSlide 3 — Matière biosourcée\nSlide 4 — À partir de 59 €\nSlide 5 — CTA : parlons de votre linéaire",
  "PAROLE D'OPTICIEN":
    "« Mes clients demandent d'où viennent les montures. Avant, je n'avais pas de réponse. »\n\nUn opticien partenaire raconte ce qui a changé dans son magasin.\n\n→ Le témoignage complet en premier commentaire.",
  "COULISSES DIRIGEANT":
    "Reprendre un atelier familial, ce n'est pas hériter d'une machine. C'est hériter d'un tour de main que personne n'a écrit.\n\n→ L'entretien est en premier commentaire.",
  "CONVERSION":
    "La paire qu'on cherchait existe. Française, responsable, et à un prix qui ne fait pas hésiter.\n\nTITRE : Lunettes françaises à partir de 59 €",
};

function captionFor(name: string): string {
  const key = Object.keys(CAPTIONS).find((candidate) => name.startsWith(candidate));
  return key ? CAPTIONS[key]! : CAPTIONS["MODÈLE DU MOIS"]!;
}

/** Six contenus par mois : le rythme observé sur les mois complets. */
function metaMonth(
  days: [number, SeedSubject["format"], string][],
  status: SeedSubject["status"],
): SeedLane {
  return {
    platform: "meta",
    name: "META",
    subjects: days.map(([day, format, name]) => ({ day, format, name, status })),
  };
}

const MONTHS: SeedMonth[] = [
  {
    label: "MARS",
    month: "2026-03-01",
    lanes: [
      metaMonth(
        [
          [3, "post", "MODÈLE DU MOIS"],
          [6, "reel", "MOMENTS BONDET 1"],
          [11, "post", "SAVOIR-FAIRE ATELIER"],
          [17, "story", "COULISSES ATELIER"],
          [20, "post", "ORIGINE FRANCE"],
          [26, "carousel", "COULEURS DE VERRES"],
        ],
        "published",
      ),
    ],
  },
  {
    label: "AVRIL",
    month: "2026-04-01",
    lanes: [
      metaMonth(
        [
          [2, "post", "NOUVEAUTÉ SOLAIRE"],
          [7, "reel", "MOMENTS BONDET 2"],
          [10, "post", "PRIX ACCESSIBLE"],
          [16, "story", "COULISSES ATELIER"],
          [21, "post", "MODÈLE DU MOIS"],
          [27, "carousel", "COULEURS DE VERRES"],
        ],
        "published",
      ),
    ],
  },
  {
    label: "MAI",
    month: "2026-05-01",
    lanes: [
      metaMonth(
        [
          [4, "post", "ORIGINE FRANCE"],
          [7, "reel", "MOMENTS BONDET 3"],
          [12, "post", "MODÈLE DU MOIS"],
          [18, "story", "COULISSES ATELIER"],
          [21, "post", "SAVOIR-FAIRE ATELIER"],
          [27, "carousel", "COULEURS DE VERRES"],
        ],
        "published",
      ),
    ],
  },
  {
    label: "JUIN",
    month: "2026-06-01",
    lanes: [
      metaMonth(
        [
          [2, "post", "NOUVEAUTÉ SOLAIRE"],
          [5, "reel", "MOMENTS BONDET 4"],
          [10, "post", "PRIX ACCESSIBLE"],
          [16, "story", "COULISSES ATELIER"],
          [19, "post", "ORIGINE FRANCE"],
          [25, "carousel", "COULEURS DE VERRES"],
        ],
        "published",
      ),
      {
        platform: "linkedin",
        name: "LINKEDIN",
        subjects: [
          { day: 3, format: "post", name: "DATA — MARCHÉ OPTIQUE", status: "published" },
          { day: 11, format: "carousel", name: "CARROUSEL USP", status: "published" },
          { day: 18, format: "post", name: "COULISSES DIRIGEANT", status: "published" },
        ],
      },
      {
        platform: "dark",
        name: "DARK",
        subjects: [
          {
            day: 1,
            format: "dark",
            name: "CONVERSION — COLLECTION SOLAIRE",
            status: "published",
            sponsoring: 4500,
            objective: "Conversion",
          },
        ],
      },
    ],
  },
  {
    label: "JUILLET",
    month: "2026-07-01",
    lanes: [
      metaMonth(
        [
          [2, "post", "MODÈLE DU MOIS"],
          [7, "reel", "MOMENTS BONDET 5"],
          [10, "post", "SAVOIR-FAIRE ATELIER"],
          [16, "story", "COULISSES ATELIER"],
          [21, "post", "PRIX ACCESSIBLE"],
          [27, "carousel", "COULEURS DE VERRES"],
        ],
        "published",
      ),
      {
        platform: "linkedin",
        name: "LINKEDIN",
        subjects: [
          {
            day: 2,
            format: "post",
            name: "DATA — FABRICATION FRANÇAISE",
            status: "published",
          },
          {
            day: 9,
            format: "carousel",
            name: "CARROUSEL COLLECTION",
            status: "published",
          },
          { day: 16, format: "post", name: "PAROLE D'OPTICIEN", status: "published" },
        ],
      },
    ],
  },
  // --- Mois en cours : les manques de production sont le sujet ---
  {
    label: "AOUT",
    month: "2026-08-01",
    lanes: [
      {
        platform: "meta",
        name: "META",
        subjects: [
          // Publication dans un jour, sans wording ni validation : les deux
          // alertes critiques du rail de santé.
          {
            day: 3,
            format: "post",
            name: "MODÈLE DU MOIS",
            status: "wording_todo",
            wording: null,
          },
          { day: 6, format: "reel", name: "MOMENTS BONDET 6", status: "validated" },
          { day: 11, format: "post", name: "LIVRAISON OFFERTE", status: "validated" },
          {
            day: 17,
            format: "story",
            name: "COULISSES ATELIER",
            status: "to_validate",
          },
          // Wording retravaillé localement, pas encore renvoyé dans Monday.
          {
            day: 20,
            format: "post",
            name: "ORIGINE FRANCE",
            status: "in_progress",
            pending:
              "Origine France Garantie, matière biosourcée, et une monture qui tient dix ans.\n\nCe qui ne se voit pas est précisément ce qui dure.\n\nToute la collection en bio.",
          },
          {
            day: 26,
            format: "carousel",
            name: "COULEURS DE VERRES",
            status: "idea",
            wording: null,
            visuals: 0,
          },
        ],
      },
      {
        platform: "linkedin",
        name: "LINKEDIN",
        subjects: [
          { day: 4, format: "post", name: "DATA — SAISONNALITÉ", status: "validated" },
          {
            day: 11,
            format: "carousel",
            name: "CARROUSEL ENGAGEMENTS",
            status: "to_validate",
          },
          {
            day: 18,
            format: "post",
            name: "PAROLE D'OPTICIEN",
            status: "wording_todo",
            wording: null,
          },
        ],
      },
      {
        platform: "dark",
        name: "DARK",
        subjects: [
          {
            day: 3,
            format: "dark",
            name: "CONVERSION — RENTRÉE",
            status: "in_progress",
            sponsoring: 3800,
            objective: "Conversion",
          },
        ],
      },
    ],
  },
  // --- Mois suivant : volontairement mal cadencé ---
  {
    label: "SEPTEMBRE",
    month: "2026-09-01",
    lanes: [
      {
        platform: "meta",
        name: "META",
        subjects: [
          // Deux Reels à la suite, et un mois qui ne démarre que le 8.
          { day: 8, format: "reel", name: "ANNONCE SILMO", status: "idea", wording: null, visuals: 0 },
          { day: 9, format: "reel", name: "TEASER SILMO", status: "idea", wording: null, visuals: 0 },
          { day: 15, format: "post", name: "MODÈLE DU MOIS", status: "in_progress" },
          // Dix jours sans rien entre le 15 et le 25.
          { day: 25, format: "post", name: "RETOUR SILMO", status: "idea", wording: null, visuals: 0 },
          // Un samedi.
          { day: 26, format: "story", name: "COULISSES SILMO", status: "idea", wording: null, visuals: 0 },
          // Sans date.
          {
            day: null,
            format: "carousel",
            name: "COULEURS DE VERRES",
            status: "idea",
            wording: null,
            visuals: 0,
          },
        ],
      },
      {
        platform: "linkedin",
        name: "LINKEDIN",
        subjects: [
          { day: 3, format: "post", name: "ANNONCE SILMO PRO", status: "in_progress" },
          {
            day: 10,
            format: "carousel",
            name: "CARROUSEL SILMO",
            status: "idea",
            wording: null,
            visuals: 0,
          },
          { day: 17, format: "post", name: "BILAN SILMO", status: "idea", wording: null, visuals: 0 },
        ],
      },
    ],
  },
];

// --- Amorçage ---------------------------------------------------------------

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
    const { rows: orgs } = await db.query<{ id: string }>(
      "select id from organizations where slug = 'antidotes'",
    );
    const orgId = orgs[0]?.id;
    if (!orgId) throw new Error("Organisation « antidotes » introuvable.");

    const { rows: workspaces } = await db.query<{ id: string }>(
      "select id from workspaces where slug = 'bondet'",
    );

    const clientId = stableId("planning-client:lunettes-bondet");

    if (reset) {
      await db.query("delete from planning_clients where id = $1", [clientId]);
      console.log("Données de démonstration effacées.");
    }

    await db.query(
      `insert into planning_clients (id, org_id, workspace_id, slug, name)
       values ($1, $2, $3, 'lunettes-bondet', 'Lunettes Bondet')
       on conflict (id) do update set name = excluded.name`,
      [clientId, orgId, workspaces[0]?.id ?? null],
    );

    const boardId = stableId("planning-board:bondet-2026");
    await db.query(
      `insert into planning_boards
         (id, client_id, monday_board_id, monday_subitem_board_id, name, year,
          is_archive, column_mapping, last_synced_at)
       values ($1, $2, 'demo-5094677213', 'demo-5094677215',
               'LUNETTES BONDET I PE 2026', 2026, false, $3::jsonb, now())
       on conflict (id) do update set
         column_mapping = excluded.column_mapping,
         last_synced_at = excluded.last_synced_at`,
      [boardId, clientId, JSON.stringify(COLUMN_MAPPING)],
    );

    let subjectCount = 0;

    for (const [monthIndex, month] of MONTHS.entries()) {
      const monthId = stableId(`planning-month:${month.month}`);
      await db.query(
        `insert into planning_months
           (id, board_id, client_id, monday_group_id, label, month, position)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (id) do update set label = excluded.label`,
        [
          monthId,
          boardId,
          clientId,
          `demo-group-${month.month}`,
          month.label,
          month.month,
          monthIndex,
        ],
      );

      for (const [laneIndex, lane] of month.lanes.entries()) {
        const laneId = stableId(`planning-lane:${month.month}:${lane.platform}`);
        await db.query(
          `insert into planning_lanes
             (id, month_id, client_id, monday_item_id, platform, name, position)
           values ($1, $2, $3, $4, $5::planning_platform, $6, $7)
           on conflict (id) do update set name = excluded.name`,
          [
            laneId,
            monthId,
            clientId,
            `demo-lane-${month.month}-${lane.platform}`,
            lane.platform,
            lane.name,
            laneIndex,
          ],
        );

        for (const [index, subject] of lane.subjects.entries()) {
          const key = `${month.month}:${lane.platform}:${index}`;
          const visuals = subject.visuals ?? 1;
          const wording =
            subject.wording === null ? null : (subject.wording ?? captionFor(subject.name));

          await db.query(
            `insert into planning_subjects
               (id, lane_id, month_id, client_id, monday_item_id, name,
                format, format_raw, scheduled_on, status, status_raw,
                wording, sponsoring, objective, owner_name, visual_urls,
                permalink, pending_wording, pending_since, monday_updated_at)
             values ($1,$2,$3,$4,$5,$6,$7::planning_format,$8,$9,
                     $10::planning_status,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
             on conflict (id) do update set
               name = excluded.name,
               status = excluded.status,
               status_raw = excluded.status_raw,
               wording = excluded.wording,
               pending_wording = excluded.pending_wording,
               pending_since = excluded.pending_since,
               visual_urls = excluded.visual_urls`,
            [
              stableId(`planning-subject:${key}`),
              laneId,
              monthId,
              clientId,
              `demo-subject-${key}`,
              subject.name,
              subject.format,
              FORMAT_RAW[subject.format],
              subject.day === null
                ? null
                : `${month.month.slice(0, 7)}-${String(subject.day).padStart(2, "0")}`,
              subject.status,
              STATUS_RAW[subject.status] || null,
              wording,
              subject.sponsoring ?? null,
              subject.objective ?? null,
              "Alessandro DI GIOVANNI",
              Array.from(
                { length: visuals },
                (_, slot) => `https://demo.antidotes.test/${key}-${slot + 1}.png`,
              ),
              null,
              subject.pending ?? null,
              subject.pending ? new Date().toISOString() : null,
              new Date().toISOString(),
            ],
          );
          subjectCount += 1;
        }
      }
    }

    await db.query(
      `insert into planning_sync_runs
         (client_id, board_id, direction, status, finished_at, boards_seen,
          subjects_upserted)
       values ($1, $2, 'pull', 'success', now(), 1, $3)`,
      [clientId, boardId, subjectCount],
    );

    const counts = await db.query<{ label: string; total: string }>(
      `select 'Mois' as label, count(*)::text as total from planning_months where client_id = $1
       union all select 'Couloirs', count(*)::text from planning_lanes where client_id = $1
       union all select 'Contenus', count(*)::text from planning_subjects where client_id = $1`,
      [clientId],
    );
    for (const row of counts.rows) console.log(`${row.label.padEnd(12)} ${row.total}`);
    console.log("\nOuvrir /planning/lunettes-bondet");
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
