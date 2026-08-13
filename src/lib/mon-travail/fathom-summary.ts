/**
 * La section « Prochaines étapes » d'un compte rendu Fathom.
 *
 * C'est la **bonne** source, et pas les `action_items` de l'API. Les deux
 * existent et ne disent pas la même chose : les `action_items` sont la liste
 * exhaustive de tout ce qui a été relevé pendant l'appel — quarante-sept
 * lignes en anglais sur douze réunions, dont la plupart ne me concernent pas.
 * « Prochaines étapes » est la synthèse de fin, en français, groupée par
 * personne, et courte : deux à cinq lignes par réunion. C'est ce qu'on relit
 * après une réunion, c'est donc ce qui doit tomber dans la todo.
 *
 * Le format est un markdown à deux niveaux :
 *
 *     ## Prochaines étapes
 *       - [**Alessandro :**](lien)
 *           - [Créer et envoyer le post Grid Talk à Pierre.](lien)
 *           - [Proposer des vidéos pour le Multi-Produit Fixe.](lien)
 *       - [**Pierre :**](lien)
 *           - [Valider les intentions d'août sur Monday.](lien)
 *
 * Un premier niveau nomme une personne et finit par deux points ; le niveau
 * en dessous porte ses tâches. On ne garde que le bloc du propriétaire.
 *
 * Pur, sans réseau ni base : les cas se rejouent sur du texte.
 */

/** Un titre de section, quel que soit son niveau. */
const HEADING = /^\s{0,3}#{1,6}\s+(.*)$/;

/** Un élément de liste, avec son retrait. */
const BULLET = /^(\s*)[-*+]\s+(.*)$/;

/** Les intitulés sous lesquels Fathom rend cette section. */
const SECTION_TITLES = ["prochaines etapes", "next steps", "prochaines actions"];

/** Minuscules, sans accents, ponctuation réduite à des espaces. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** `[texte](url)` → `texte`, et `**gras**` → `gras`. */
function stripMarkdown(value: string): string {
  return value
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .trim();
}

/** La première URL d'une ligne, quand elle en porte une. */
function firstLink(value: string): string | null {
  return /\]\((https?:\/\/[^)\s]+)\)/.exec(value)?.[1] ?? null;
}

export type NextStep = {
  /** Le libellé de la tâche, nettoyé de son markdown. */
  text: string;
  /** Le lien horodaté vers le moment de la réunion, quand il y en a un. */
  url: string | null;
};

/**
 * Le bloc de tâches d'une personne, dans la section « Prochaines étapes ».
 *
 * Rend une liste vide plutôt que `null` quand la section est absente ou que
 * la personne n'y figure pas : les deux cas veulent le même comportement —
 * aucune tâche — et les distinguer n'aurait servi à rien.
 *
 * `owner` est comparé au **premier mot** du nom : le compte rendu écrit
 * « Alessandro » là où le compte Fathom dit « Alessandro DI GIOVANNI ».
 */
export function extractNextSteps(markdown: string, owner: string): NextStep[] {
  const lines = markdown.split(/\r?\n/);

  // --- Repérer la section --------------------------------------------------
  let start = -1;
  let end = lines.length;
  for (let i = 0; i < lines.length; i += 1) {
    const heading = HEADING.exec(lines[i]!);
    if (!heading) continue;
    const title = normalize(stripMarkdown(heading[1]!));
    if (start === -1) {
      if (SECTION_TITLES.some((candidate) => title.startsWith(candidate))) start = i;
    } else {
      // Le titre suivant, quel que soit son niveau, ferme la section.
      end = i;
      break;
    }
  }
  if (start === -1) return [];

  // --- Parcourir les puces -------------------------------------------------
  const target = normalize(owner).split(" ")[0] ?? "";
  if (target.length === 0) return [];

  const body = lines.slice(start + 1, end);

  /* Le retrait des intitulés de personne : le moins profond de la section.
     Sans cette borne, une **tâche** qui finit par deux points passerait pour
     un intitulé — « Envoyer à Alessandro les assets via WeTransfer/Drive : »
     ouvrait le bloc d'Alessandro et lui attribuait les trois lignes de Pierre
     qui suivaient. Un nom de personne est toujours au premier niveau. */
  let headerIndent = Number.POSITIVE_INFINITY;
  for (const line of body) {
    const bullet = BULLET.exec(line);
    if (bullet) headerIndent = Math.min(headerIndent, bullet[1]!.length);
  }

  const steps: NextStep[] = [];
  /** Retrait de l'intitulé « Alessandro : », `null` hors de son bloc. */
  let ownerIndent: number | null = null;
  /** Retrait des tâches du bloc — le premier niveau sous l'intitulé. */
  let taskIndent: number | null = null;

  for (const line of body) {
    const bullet = BULLET.exec(line);
    if (!bullet) continue;

    const indent = bullet[1]!.length;
    const raw = bullet[2]!;
    const text = stripMarkdown(raw);
    if (text.length === 0) continue;

    // Une puce qui nomme quelqu'un : « **Alessandro :** ». Elle ouvre le bloc
    // ou le referme, selon qui elle nomme.
    if (indent === headerIndent && text.endsWith(":")) {
      const person = normalize(text.slice(0, -1));
      ownerIndent = person.split(" ").includes(target) ? indent : null;
      taskIndent = null;
      continue;
    }

    if (ownerIndent === null) continue;

    // À retrait égal ou moindre que l'intitulé, on est sorti du bloc.
    if (indent <= ownerIndent) {
      ownerIndent = null;
      taskIndent = null;
      continue;
    }

    /* Le premier niveau sous la personne fixe le retrait des tâches. Ce qui
       est plus en retrait détaille la ligne du dessus — « Photos porté »,
       « Lookbook PDF » sous « Envoyer les assets » — et ne devient pas une
       tâche à part : la ligne parente suffit à la retrouver. */
    taskIndent ??= indent;
    if (indent > taskIndent) continue;

    steps.push({ text, url: firstLink(raw) });
  }

  return steps;
}
