/**
 * Le prompt du studio — pur. La tonalité ne se décrit pas, elle se
 * démontre : le modèle reçoit mes posts les plus proches du sujet comme
 * exemples, et le post de la veille qui a inspiré le sujet comme matière,
 * jamais comme modèle à recopier.
 *
 * La forme est cadrée en dur : une accroche en première ligne, des
 * paragraphes courts, pas de tirade, pas de liste à puces mécanique, pas
 * de hashtags en rafale, pas d'emoji par défaut, entre 800 et 1 500
 * caractères — le format qui se lit dans le fil.
 */

export type StudioExample = { content: string; similarity: number };

export type StudioInput = {
  topic: string;
  angle: string | null;
  brief: string | null;
  examples: StudioExample[];
  /** Le post de la veille qui a inspiré le sujet, s'il y en a un. */
  source: { platform: string; author: string | null; content: string } | null;
  authorName: string | null;
};

export const STUDIO_SYSTEM = `Tu écris des posts LinkedIn pour un freelance social media strategist français, en son nom. Il accompagne des marques et des commerces sur leur stratégie social media et leur acquisition payante, et publie pour attirer des clients.

Sa voix, tu la lis dans les exemples fournis : ce sont ses propres posts. Reproduis leur registre — longueur des phrases, tutoiement ou vouvoiement, humour ou sécheresse, façon d'ouvrir et de conclure — sans jamais recopier une phrase.

Forme imposée : la première ligne est l'accroche et doit tenir seule ; des paragraphes de une à trois lignes ; entre 800 et 1 500 caractères ; pas de liste à puces sauf si les exemples en font ; pas de hashtag ; pas d'emoji sauf si les exemples en ont ; pas de « Voici », pas de « Dans cet article », pas de morale finale. Une seule idée, poussée jusqu'au bout, avec au moins un détail concret (chiffre, situation, geste).

Si un post de la veille est fourni, il est la matière — un angle, un constat — jamais un modèle : le post rendu ne doit ressembler ni à sa structure ni à ses formules.

Réponds avec le texte du post seulement, sans titre, sans guillemets, sans commentaire.`;

export function buildStudioPrompt(input: StudioInput): string {
  const parts: string[] = [];
  parts.push(`SUJET : ${input.topic}`);
  if (input.angle) parts.push(`ANGLE : ${input.angle}`);
  if (input.brief) parts.push(`CONSIGNES : ${input.brief}`);
  if (input.authorName) parts.push(`AUTEUR : ${input.authorName}`);
  if (input.examples.length > 0) {
    parts.push(
      `MES POSTS, DU PLUS PROCHE AU PLUS LOIN DU SUJET (registre à reproduire, formules à ne pas reprendre) :\n\n${input.examples
        .map((example, index) => `[Exemple ${index + 1}]\n${example.content.trim()}`)
        .join("\n\n")}`,
    );
  } else {
    parts.push("MES POSTS : aucun exemple disponible — écris sobre, direct, à la première personne.");
  }
  if (input.source) {
    parts.push(
      `POST DE LA VEILLE QUI A INSPIRÉ LE SUJET (${input.source.platform}${input.source.author ? `, ${input.source.author}` : ""}) — matière, pas modèle :\n${input.source.content.trim().slice(0, 1500)}`,
    );
  }
  return parts.join("\n\n");
}

/** Nettoie ce que le modèle rend : guillemets englobants, clôtures, espaces. */
export function cleanGeneratedPost(raw: string): string {
  return raw
    .trim()
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/\s*```$/, "")
    .replace(/^["«]\s*/, "")
    .replace(/\s*["»]$/, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Ce que LinkedIn tolère dans une publication : 3 000 caractères. */
export const LINKEDIN_MAX_CHARS = 3000;
