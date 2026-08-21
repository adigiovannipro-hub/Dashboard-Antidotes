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

const CONTENT_DIR = path.join(process.cwd(), "scripts", "data", "academy");
const OUTPUT = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "0058_academy_seed.sql",
);

const COURSE = {
  slug: "devenir-freelance-social-media-manager",
  title: "Antidotes Academy — Devenir freelance social media manager",
  description:
    "La méthodologie Antidotes de bout en bout : positionnement, acquisition, production, publicité, mesure et gestion d'activité. Treize modules, un script complet par leçon, à suivre dans l'ordre ou à la carte.",
};

const EXPECTED_MODULES = 13;
const RESOURCE_KINDS = new Set(["template", "checklist", "link", "tool"]);
const FORBIDDEN = [/lorem/i, /\bTODO\b/i, /placeholder/i, /à compléter/i, /\bXXX\b/];

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
  const directories = (await readdir(CONTENT_DIR, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  check(
    directories.length === EXPECTED_MODULES,
    `${directories.length} dossiers de module trouvés, ${EXPECTED_MODULES} attendus : ${directories.join(", ")}`,
  );

  const statements: string[] = [];
  const courseId = stableId(`academy:course:${COURSE.slug}`);

  statements.push(
    `insert into academy_courses (id, org_id, slug, title, description, order_index, published)
select '${courseId}'::uuid, o.id, '${COURSE.slug}', ${quote(COURSE.title)}, ${quote(COURSE.description)}, 1, true
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

    const moduleId = stableId(`academy:module:${parsed.slug}`);
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
          lesson.resources.length <= 4,
        `${where} : ${lesson.resources?.length ?? 0} ressources, 2 à 4 attendues.`,
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
      }));

      const lessonId = stableId(`academy:lesson:${parsed.slug}/${lesson.slug}`);
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
