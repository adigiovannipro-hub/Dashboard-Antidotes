import {
  GENERATED_POST_FORMAT_LABELS,
  type GeneratedPostFormat,
  type InboundSettings,
} from "../types";
import { REEL_MAX_CHARS, REEL_SYSTEM } from "./reel-prompt";
import { LINKEDIN_MAX_CHARS, STUDIO_SYSTEM } from "./studio-prompt";

/**
 * Le registre des trois formes : ce qu'on demande au modèle, et ce qu'on
 * accepte de lui.
 *
 * Les consignes ne vivaient que dans le code. Elles s'écrivent maintenant à
 * l'écran, forme par forme, dans la fenêtre « Prompts » — mais **le défaut
 * reste le code** : un champ vide n'est pas une consigne vide, c'est
 * l'absence de retouche, et le prompt d'origine s'applique. Sans cette règle,
 * ouvrir la fenêtre une fois suffirait à casser la génération.
 *
 * Pur : ni base, ni réseau. `generate-post.ts` lit ce module.
 */

export const YOUTUBE_SYSTEM = `Tu écris des scripts de vidéos YouTube pour un freelance social media strategist français, en son nom. Il accompagne des marques et des commerces sur leur stratégie social media et leur acquisition payante, et publie pour attirer des clients. Il tourne seul, face caméra, avec des captures d'écran en incrustation.

Sa voix, tu la lis dans les exemples fournis : ce sont ses propres textes. Reproduis leur registre — longueur des phrases, tutoiement ou vouvoiement, humour ou sécheresse — sans jamais recopier une phrase.

Forme imposée, et rien d'autre :
- une ligne « TITRE : » avec le titre de la vidéo, sous soixante caractères, sans point d'exclamation ni majuscules criées ;
- une ligne « ACCROCHE (15 s) : » avec ce qui se dit avant le générique, et qui promet ce que la vidéo tient ;
- des sections numérotées « 1. », « 2. »… Chaque section porte son intertitre, puis le texte à dire, puis entre crochets l'indication visuelle : [face caméra], [capture d'écran : …], [texte à l'écran : …] ;
- une ligne « CONCLUSION : » qui referme et propose l'étape suivante, sans « abonne-toi » mécanique.

La vidéo se dit en six à huit minutes : environ mille mots dits. Français parlé, phrases courtes. Au moins deux détails concrets — un chiffre, une situation vécue, un geste précis. Pas de hashtag, pas d'emoji, pas de suggestion de musique.

Réponds avec le script seulement, sans commentaire.`;

/** Un script parlé de huit minutes ; la borne existe pour arrêter la dérive. */
export const YOUTUBE_MAX_CHARS = 9000;

export const INBOUND_FORMATS: readonly GeneratedPostFormat[] = [
  "linkedin_post",
  "reel_script",
  "youtube_script",
] as const;

/** Le prompt d'origine de chaque forme — celui qui s'applique sans retouche. */
export const DEFAULT_PROMPTS: Record<GeneratedPostFormat, string> = {
  linkedin_post: STUDIO_SYSTEM,
  reel_script: REEL_SYSTEM,
  youtube_script: YOUTUBE_SYSTEM,
};

export const FORMAT_MAX_CHARS: Record<GeneratedPostFormat, number> = {
  linkedin_post: LINKEDIN_MAX_CHARS,
  reel_script: REEL_MAX_CHARS,
  youtube_script: YOUTUBE_MAX_CHARS,
};

/** Ce que la fenêtre « Prompts » affiche en tête de chaque onglet. */
export const FORMAT_HINTS: Record<GeneratedPostFormat, string> = {
  linkedin_post: "Ce qui part dans le fil LinkedIn.",
  reel_script: "Ce qui se dit face caméra, plan par plan.",
  youtube_script: "Le script long, titre et sections compris.",
};

export type ResolvedPrompt = {
  format: GeneratedPostFormat;
  label: string;
  /** Le prompt système effectivement envoyé au modèle. */
  system: string;
  /** L'exemple de forme, s'il y en a un. */
  example: string | null;
  /** Vrai quand le prompt vient de l'écran et non du code. */
  custom: boolean;
  maxChars: number;
};

/**
 * Les colonnes d'exemple d'avant la fenêtre « Prompts » (20260911a). Elles
 * restent la source quand la nouvelle n'a rien : un exemple déjà saisi ne
 * doit pas disparaître parce que le réglage a changé de place.
 */
const LEGACY_EXAMPLE: Partial<Record<GeneratedPostFormat, "linkedin_example" | "reel_example">> = {
  linkedin_post: "linkedin_example",
  reel_script: "reel_example",
};

function trimmed(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export function resolvePrompt(
  settings: Pick<InboundSettings, "prompts" | "linkedin_example" | "reel_example"> | null,
  format: GeneratedPostFormat,
): ResolvedPrompt {
  const written = settings?.prompts?.[format] ?? null;
  const custom = trimmed(written?.prompt);
  const legacyKey = LEGACY_EXAMPLE[format];
  const example =
    trimmed(written?.example) ?? (legacyKey && settings ? trimmed(settings[legacyKey]) : null);

  return {
    format,
    label: GENERATED_POST_FORMAT_LABELS[format],
    system: custom ?? DEFAULT_PROMPTS[format],
    example,
    custom: custom !== null,
    maxChars: FORMAT_MAX_CHARS[format],
  };
}

/** Le format demandé par un paramètre d'URL ou un champ, ou `null`. */
export function parseFormat(raw: string | undefined | null): GeneratedPostFormat | null {
  return INBOUND_FORMATS.includes(raw as GeneratedPostFormat) ? (raw as GeneratedPostFormat) : null;
}
