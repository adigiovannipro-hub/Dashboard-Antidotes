/**
 * Le script d'un reel, dans ma voix.
 *
 * Même matière que le post LinkedIn — un sujet, un post de la veille, mes
 * exemples — mais une autre forme : ce qui se dit à voix haute, plan par
 * plan, en quarante-cinq à soixante secondes. Un post lu et un script parlé
 * ne se coupent pas aux mêmes endroits ; générer l'un puis le « raccourcir »
 * donne un texte écrit récité, ce qui s'entend.
 *
 * Pur : ni base, ni réseau. `generate-post.ts` choisit ce prompt ou celui du
 * post selon le format demandé.
 */

import type { StudioExample } from "./studio-prompt";

export type ReelInput = {
  topic: string;
  angle: string | null;
  brief: string | null;
  /** Mes consignes de voix, telles qu'elles sont écrites dans l'onglet Consignes. */
  guidelines: string | null;
  /** Un de mes scripts, comme exemple de forme et de débit. */
  example: string | null;
  /** Mes posts les plus proches du sujet : le registre, pas la forme. */
  examples: StudioExample[];
  source: { platform: string; author: string | null; content: string } | null;
  authorName: string | null;
};

export const REEL_SYSTEM = `Tu écris des scripts de reels pour un freelance social media strategist français, en son nom. Il accompagne des marques et des commerces sur leur stratégie social media et leur acquisition payante, et publie pour attirer des clients. Il tourne face caméra, seul, sans équipe.

Sa voix, tu la lis dans les exemples fournis : ce sont ses propres textes. Reproduis leur registre — longueur des phrases, tutoiement ou vouvoiement, humour ou sécheresse — sans jamais recopier une phrase.

Forme imposée, et rien d'autre :
- une ligne « ACCROCHE (3 s) : » avec la phrase exacte à dire face caméra, qui tient seule et donne envie de rester ;
- puis des plans numérotés « 1. », « 2. »… Chaque plan porte le texte à dire, puis entre crochets l'indication visuelle : [face caméra], [plan serré sur l'écran], [texte à l'écran : …] ;
- une dernière ligne « CHUTE : » qui referme et invite à commenter ou à écrire, sans « lien en bio ».

Le script se dit en quarante-cinq à soixante secondes : environ cent quarante mots dits, pas plus. Français parlé, phrases courtes, une seule idée. Au moins un détail concret — un chiffre, une situation, un geste. Pas de hashtag, pas d'emoji, pas de didascalie de montage, pas de musique suggérée.

Réponds avec le script seulement, sans titre, sans guillemets, sans commentaire.`;

export function buildReelPrompt(input: ReelInput): string {
  const parts: string[] = [];
  parts.push(`SUJET : ${input.topic}`);
  if (input.angle) parts.push(`ANGLE : ${input.angle}`);
  if (input.brief) parts.push(`CONSIGNES DU JOUR : ${input.brief}`);
  if (input.guidelines) parts.push(`COMMENT J'ÉCRIS (à respecter avant tout le reste) :\n${input.guidelines.trim()}`);
  if (input.authorName) parts.push(`AUTEUR : ${input.authorName}`);
  if (input.example) parts.push(`UN DE MES SCRIPTS (forme et débit à retrouver) :\n${input.example.trim()}`);
  if (input.examples.length > 0) {
    parts.push(
      `MES POSTS SUR DES SUJETS PROCHES (registre à reproduire, formules à ne pas reprendre) :\n\n${input.examples
        .map((example, index) => `[Exemple ${index + 1}]\n${example.content.trim()}`)
        .join("\n\n")}`,
    );
  }
  if (input.source) {
    parts.push(
      `CONTENU DE LA VEILLE QUI A INSPIRÉ LE SUJET (${input.source.platform}${input.source.author ? `, ${input.source.author}` : ""}) — matière, pas modèle :\n${input.source.content.trim().slice(0, 1500)}`,
    );
  }
  return parts.join("\n\n");
}

/** Un script parlé n'a pas de limite de plateforme ; celle-ci borne la dérive. */
export const REEL_MAX_CHARS = 2500;
