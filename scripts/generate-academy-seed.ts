/**
 * Fabrique la migration de données `0058_academy_seed.sql` depuis les fichiers
 * de contenu de `scripts/data/academy/`.
 *
 *   pnpm generate:academy-seed
 *
 * Les fichiers de contenu — un dossier par module, `module.json` plus un
 * markdown par leçon — restent la source relisible et corrigeable ; la
 * migration générée est ce que le runner applique. La régénérer après avoir
 * touché un fichier de contenu **ne sert que tant que 0058 n'est pas
 * appliquée** : une migration passée ne se rejoue jamais, une retouche de
 * script se fait ensuite depuis le back-office `/academy/admin`.
 *
 * Garde-fous, dans l'esprit d'`import-followers` : tout écart — fichier
 * manquant, JSON invalide, script hors gabarit, reste de placeholder — fait
 * échouer la génération en le disant. Une perte silencieuse ne doit pas
 * ressembler à un succès.
 */
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Les formations. Chacune a son dossier de contenu et sa migration de sortie.
 *
 * **Ne jamais changer la sortie d'une formation déjà appliquée** : le runner
 * trace par nom et par empreinte, un fichier modifié affiche « ⚠ modifiée
 * depuis » et ne se rejoue pas. `0058` est appliquée à la vraie base depuis
 * le 22/08 ; la régénérer doit produire exactement les mêmes octets, ce que
 * garantit le fait de n'ajouter `body` à une ressource que lorsqu'elle en
 * porte un.
 */
const COURSES = [
  {
    directory: "academy",
    output: "0058_academy_seed.sql",
    orderIndex: 1,
    expectedModules: 13,
    /* Ses identifiants sont dérivés sans le slug du cours — c'était la seule
       formation quand `0058` a été écrite, et cette migration est appliquée :
       elle doit se régénérer à l'octet près. Voir `COLLISIONS_FIGEES`. */
    legacyIdKeys: true,
    slug: "devenir-freelance-social-media-manager",
    title: "Antidotes Academy — Devenir freelance social media manager",
    description:
      "La méthodologie Antidotes de bout en bout : positionnement, acquisition, production, publicité, mesure et gestion d'activité. Treize modules, un script complet par leçon, à suivre dans l'ordre ou à la carte.",
  },
  {
    directory: "academy-ugc",
    output: "20260903c_academy_ugc_seed.sql",
    orderIndex: 2,
    expectedModules: 14,
    /* Même contrainte : `20260903c` est appliquée. Le module « Gérer son
       activité » y est perdu par collision de slug avec la formation
       précédente ; `20260903d` le répare avec un identifiant nommé par
       formation, et ce fichier-ci ne doit plus bouger. */
    legacyIdKeys: true,
    slug: "devenir-libre-grace-a-l-ugc",
    title: "Devenir libre grâce à l'UGC",
    description:
      "Le métier de créatrice UGC de bout en bout : se positionner, monter un portfolio qui fait signer, trouver des marques, tarifer, négocier, tourner, monter, livrer dans les temps et fidéliser. Quatorze modules, un script complet par leçon, et les documents de travail fournis avec.",
  },
] as const;

const RESOURCE_KINDS = new Set([
  "template",
  "checklist",
  "link",
  "tool",
  "document",
]);
const FORBIDDEN = [/lorem/i, /\bTODO\b/i, /placeholder/i, /à compléter/i, /\bXXX\b/];

/**
 * Les collisions déjà figées par une migration appliquée.
 *
 * `gerer-son-activite` et sa leçon `organiser-sa-semaine` existent dans les
 * deux formations. Les clés historiques ne portant pas le cours, elles tombent
 * sur le même SHA-256 — ce qui a fait perdre en silence le quatorzième module
 * de l'UGC au premier passage. `20260903d` répare la base ; ces deux clés
 * restent en double dans les fichiers générés, qu'on ne peut plus toucher.
 *
 * Toute **nouvelle** collision fait échouer la génération : une formation
 * ajoutée après celles-ci porte son slug dans la clé, et ne peut donc plus
 * collisionner avec une autre — mais elle le peut avec elle-même si deux
 * modules partagent un slug, et c'est ce que la garde attrape.
 */
const COLLISIONS_FIGEES = new Set([
  "academy:module:gerer-son-activite",
  "academy:lesson:gerer-son-activite/organiser-sa-semaine",
]);

/** Les clés déjà consommées : deux fois la même est une collision. */
const clesVues = new Set<string>();

/**
 * La clé d'un objet du seed.
 *
 * Une formation ajoutée après septembre 2026 porte **son slug dans la clé** :
 * sans ça, deux formations qui partagent un slug de module se volent leurs
 * lignes, et `on conflict do nothing` le fait sans un mot.
 */
function idKey(course: CourseSpec, kind: string, path: string): string {
  return course.legacyIdKeys
    ? `academy:${kind}:${path}`
    : `academy:${kind}:${course.slug}/${path}`;
}

/**
 * `stableId`, plus le refus d'une clé déjà consommée.
 *
 * Le contrôle porte sur la **clé** et non sur l'UUID : une collision naît
 * toujours de deux objets qui produisent la même clé — deux modules de
 * formations différentes portant le même slug, par exemple. Comparer les UUID
 * reviendrait au même, avec un message moins clair.
 */
function uniqueId(key: string): string {
  check(
    !clesVues.has(key) || COLLISIONS_FIGEES.has(key),
    `collision d'identifiant : la clé « ${key} » est produite deux fois, et \`on conflict do nothing\` jetterait le second objet en silence. Renomme un slug — les identifiants d'une formation historique ne portent pas le cours.`,
  );
  clesVues.add(key);
  return stableId(key);
}

/** UUID stable dérivé d'une clé : régénérer ne change aucun identifiant. */
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

/** Chaîne SQL en dollar-quoting, avec un tag qui ne peut pas être dans le texte. */
function quote(text: string): string {
  let tag = "$sq$";
  let index = 0;
  while (text.includes(tag)) {
    index += 1;
    tag = `$sq${index}$`;
  }
  return `${tag}${text}${tag}`;
}

type ResourceJson = {
  title: string;
  description: string | null;
  kind: string;
  url: string | null;
  /** Le document lui-même, quand la ressource en est un. */
  body?: string | null;
};

type LessonJson = {
  position: number;
  slug: string;
  title: string;
  summary: string;
  duration_min: number;
  script_file: string;
  resources: ResourceJson[];
};

type ModuleJson = {
  slug: string;
  title: string;
  description: string;
  position: number;
  lessons: LessonJson[];
};

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

async function main() {
  for (const course of COURSES) {
    await generate(course);
  }
}

type CourseSpec = (typeof COURSES)[number];

async function generate(course: CourseSpec) {
  const CONTENT_DIR = path.join(process.cwd(), "scripts", "data", course.directory);
  const OUTPUT = path.join(process.cwd(), "supabase", "migrations", course.output);
  const COURSE = course;
  const EXPECTED_MODULES = course.expectedModules;

  const directories = (await readdir(CONTENT_DIR, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  check(
    directories.length === EXPECTED_MODULES,
    `${directories.length} dossiers de module trouvés, ${EXPECTED_MODULES} attendus : ${directories.join(", ")}`,
  );

  const statements: string[] = [];
  const courseId = uniqueId(`academy:course:${COURSE.slug}`);

  statements.push(
    `insert into academy_courses (id, org_id, slug, title, description, order_index, published)
select '${courseId}'::uuid, o.id, '${COURSE.slug}', ${quote(COURSE.title)}, ${quote(COURSE.description)}, ${COURSE.orderIndex}, true
from organizations o
order by o.created_at
limit 1
on conflict (id) do nothing;`,
  );

  let lessonTotal = 0;

  for (const directory of directories) {
    const moduleDir = path.join(CONTENT_DIR, directory);
    const raw = await readFile(path.join(moduleDir, "module.json"), "utf8").catch(
      () => {
        throw new Error(`${directory}/module.json est introuvable.`);
      },
    );

    let parsed: ModuleJson;
    try {
      parsed = JSON.parse(raw) as ModuleJson;
    } catch (error) {
      throw new Error(`${directory}/module.json ne parse pas : ${(error as Error).message}`);
    }

    check(parsed.slug, `${directory} : slug manquant.`);
    check(parsed.title, `${directory} : titre manquant.`);
    check(parsed.description, `${directory} : description manquante.`);
    check(Number.isInteger(parsed.position), `${directory} : position manquante.`);
    check(
      Array.isArray(parsed.lessons) && parsed.lessons.length > 0,
      `${directory} : aucune leçon.`,
    );

    const moduleId = uniqueId(idKey(COURSE, "module", parsed.slug));
    statements.push(
      `insert into academy_modules (id, course_id, org_id, slug, title, description, order_index, published)
select '${moduleId}'::uuid, c.id, c.org_id, '${parsed.slug}', ${quote(parsed.title)}, ${quote(parsed.description)}, ${parsed.position}, true
from academy_courses c
where c.id = '${courseId}'::uuid
on conflict (id) do nothing;`,
    );

    for (const lesson of parsed.lessons) {
      const where = `${directory}/${lesson.slug ?? "?"}`;
      check(lesson.slug, `${where} : slug manquant.`);
      check(lesson.title, `${where} : titre manquant.`);
      check(lesson.summary, `${where} : summary manquant.`);
      check(
        Number.isInteger(lesson.duration_min) &&
          lesson.duration_min >= 4 &&
          lesson.duration_min <= 20,
        `${where} : duration_min hors bornes (${lesson.duration_min}).`,
      );
      check(Number.isInteger(lesson.position), `${where} : position manquante.`);
      check(
        Array.isArray(lesson.resources) &&
          lesson.resources.length >= 2 &&
          lesson.resources.length <= 5,
        `${where} : ${lesson.resources?.length ?? 0} ressources, 2 à 5 attendues.`,
      );
      for (const resource of lesson.resources) {
        check(resource.title, `${where} : ressource sans titre.`);
        check(
          RESOURCE_KINDS.has(resource.kind),
          `${where} : kind de ressource inconnu (${resource.kind}).`,
        );
        check(
          resource.url === null || /^https?:\/\//.test(resource.url),
          `${where} : URL de ressource invalide (${resource.url}).`,
        );
        // Un document sans texte n'est pas un document : la leçon afficherait
        // « Ouvrir le document » sur du vide.
        check(
          resource.kind !== "document" || (resource.body ?? "").trim().length > 200,
          `${where} : le document « ${resource.title} » est vide ou trop court.`,
        );
      }

      const script = await readFile(
        path.join(moduleDir, lesson.script_file),
        "utf8",
      ).catch(() => {
        throw new Error(`${where} : ${lesson.script_file} est introuvable.`);
      });

      const words = wordCount(script);
      check(
        words >= 600 && words <= 2000,
        `${where} : ${words} mots — hors du gabarit 800-1500 (marge 600-2000).`,
      );
      check(
        script.trimStart().startsWith("## L'accroche"),
        `${where} : le script ne commence pas par « ## L'accroche ».`,
      );
      for (const pattern of FORBIDDEN) {
        check(
          !pattern.test(script),
          `${where} : le script contient un reste de placeholder (${pattern}).`,
        );
      }

      const normalizedResources = lesson.resources.map((resource) => ({
        title: resource.title,
        description: resource.description ?? null,
        kind: resource.kind,
        url: resource.url ?? null,
        // `body` n'est écrit que s'il existe : l'ajouter partout, fût-ce à
        // `null`, changerait les octets de `0058`, déjà appliquée.
        ...(resource.body ? { body: resource.body } : {}),
      }));

      const lessonId = uniqueId(idKey(COURSE, "lesson", `${parsed.slug}/${lesson.slug}`));
      statements.push(
        `insert into academy_lessons (id, module_id, course_id, org_id, slug, title, summary, script_mdx, duration_min, video_provider, resources, order_index, published)
select '${lessonId}'::uuid, m.id, m.course_id, m.org_id, '${lesson.slug}', ${quote(lesson.title)}, ${quote(lesson.summary)}, ${quote(script.trim())}, ${lesson.duration_min}, 'none'::academy_video_provider, ${quote(JSON.stringify(normalizedResources))}::jsonb, ${lesson.position}, true
from academy_modules m
where m.id = '${moduleId}'::uuid
on conflict (id) do nothing;`,
      );
      lessonTotal += 1;
    }
  }

  const header = `-- ===========================================================================
-- Antidotes Academy — contenu de la formation
--
-- GÉNÉRÉ par \`pnpm generate:academy-seed\` depuis \`scripts/data/academy/\` —
-- ne pas éditer à la main : corriger le fichier de contenu et régénérer
-- (tant que la migration n'est pas appliquée ; ensuite, le back-office
-- \`/academy/admin\` est l'éditeur).
--
-- ${EXPECTED_MODULES} modules, ${lessonTotal} leçons, tout publié. Identifiants stables
-- (SHA-256 du chemin) et \`on conflict do nothing\` : rejouer n'écrase jamais
-- une retouche faite depuis le back-office. Le cours se rattache à la
-- première organisation — la base n'en porte qu'une ; une base vierge sans
-- organisation n'insère rien, sans erreur.
--
-- Les littéraux d'un \`insert ... select\` ne sont pas convertis vers un enum
-- comme ceux d'un \`insert ... values\` : le cast \`::academy_video_provider\`
-- est explicite, c'est le piège documenté du CLAUDE.md.
-- ===========================================================================
`;

  await writeFile(OUTPUT, `${header}\n${statements.join("\n\n")}\n`);
  console.log(
    `✓ ${OUTPUT} — ${EXPECTED_MODULES} modules, ${lessonTotal} leçons, ${statements.length} ordres SQL.`,
  );
}

main().catch((error) => {
  console.error(`✗ Génération refusée : ${(error as Error).message}`);
  process.exit(1);
});
