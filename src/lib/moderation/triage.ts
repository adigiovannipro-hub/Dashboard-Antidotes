import type { ModerationFlag, SupportedLocale } from "./types";

/**
 * Tri automatique d'un message entrant : langue et signalements.
 *
 * Volontairement lexical et local, pas un appel au modèle. Trois raisons : le
 * tri doit être instantané à l'ingestion, il doit être déterministe pour être
 * testable, et un signalement « litige » ne doit pas dépendre d'un service
 * distant qui peut tomber. Le modèle intervient ensuite, pour rédiger.
 */

// --- Détection de langue ---------------------------------------------------

/**
 * Mots-outils très fréquents, discriminants entre français et anglais. On ne
 * cherche pas à identifier 100 langues : le produit répond en français par
 * défaut et en anglais si le message est anglais, rien d'autre.
 */
const FRENCH_MARKERS = [
  "je", "tu", "vous", "nous", "le", "la", "les", "un", "une", "des", "du",
  "est", "sont", "être", "avoir", "pas", "plus", "avec", "pour", "dans", "sur",
  "que", "qui", "quoi", "comment", "pourquoi", "quand", "où", "combien",
  "bonjour", "bonsoir", "merci", "svp", "s'il", "vous", "plaît", "cordialement",
  "commande", "livraison", "produit", "prix", "taille", "couleur", "boutique",
  "remboursement", "échange", "retour", "colis", "facture",
];

const ENGLISH_MARKERS = [
  "i", "you", "we", "the", "a", "an", "of", "is", "are", "be", "have", "not",
  "with", "for", "in", "on", "that", "which", "what", "how", "why", "when",
  "where", "much", "many",
  "hello", "hi", "thanks", "thank", "please", "regards",
  "order", "delivery", "shipping", "product", "price", "size", "color",
  "refund", "exchange", "return", "parcel", "invoice",
];

/** Diacritiques français : un signal fort, absent de l'anglais courant. */
const FRENCH_DIACRITICS = /[àâäçéèêëîïôöùûüÿœæ]/i;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['']/g, "'")
    .split(/[^a-zà-öø-ÿ']+/i)
    .filter((token) => token.length > 0);
}

export type LanguageDetection = {
  locale: SupportedLocale;
  /** Confiance dans `[0, 1]`. Sous 0,55 on retombe sur la langue par défaut. */
  confidence: number;
};

/**
 * Détecte la langue d'un message entrant.
 *
 * Le français est la valeur par défaut : sur un message trop court ou ambigu
 * (« ok », « 👍 », un simple lien), répondre en français à un client français
 * est le bon comportement, et c'est le cas majoritaire.
 */
export function detectLanguage(
  text: string,
  fallback: SupportedLocale = "fr",
): LanguageDetection {
  const tokens = tokenize(text);
  if (tokens.length === 0) return { locale: fallback, confidence: 0 };

  let french = 0;
  let english = 0;
  for (const token of tokens) {
    if (FRENCH_MARKERS.includes(token)) french += 1;
    // « a », « i » et « on » existent dans les deux langues : on ne les compte
    // en anglais que s'ils ne sont pas déjà comptés en français.
    else if (ENGLISH_MARKERS.includes(token)) english += 1;
  }

  if (FRENCH_DIACRITICS.test(text)) french += 2;

  const total = french + english;
  if (total === 0) return { locale: fallback, confidence: 0 };

  const locale: SupportedLocale = french >= english ? "fr" : "en";
  const confidence = Math.max(french, english) / total;

  if (confidence < 0.55) return { locale: fallback, confidence };
  return { locale, confidence };
}

// --- Détection de signalements --------------------------------------------

/**
 * Chaque signalement a ses motifs. Les accents sont retirés avant comparaison
 * pour attraper « rembourser » comme « remboursé » ou « rembourse ».
 */
const FLAG_PATTERNS: Record<ModerationFlag, RegExp[]> = {
  refund: [
    /\brembours/i,
    /\bavoir\b.*\bcommande\b/i,
    /\brefund/i,
    /\bmoney back\b/i,
    /\bannuler ma commande\b/i,
  ],
  dispute: [
    /\bavocat\b/i,
    /\bmise en demeure\b/i,
    /\bplainte\b/i,
    /\bsignaler? (a|à) la dgccrf\b/i,
    /\bque choisir\b/i,
    /\blitige\b/i,
    /\btribunal\b/i,
    /\blawyer\b/i,
    /\blegal action\b/i,
    /\bchargeback\b/i,
    // Accords et féminins inclus : « jamais reçu », « jamais reçue », « jamais
    // reçus ». Le texte est déjà désaccentué à ce stade, d'où le `[cç]`.
    /\bjamais re[cç]ue?s?\b/i,
    /\btoujours rien re[cç]ue?s?\b/i,
    /\bcommande jamais arriv[ée]e?\b/i,
  ],
  insult: [
    /\bconnard?s?\b/i,
    /\bsalop/i,
    /\bencul/i,
    /\bfdp\b/i,
    /\bta gueule\b/i,
    /\bnul(le)?s? (a|à) chier\b/i,
    /\barnaque(urs?)?\b/i,
    /\bvoleurs?\b/i,
    /\bescro/i,
    /\bscam(mers?)?\b/i,
    /\bfuck/i,
    /\bshit\b/i,
  ],
  sensitive: [
    /\ballerg/i,
    /\bintoxic/i,
    /\bhospitalis/i,
    /\burgence medicale\b/i,
    /\benceinte\b/i,
    /\bgrossesse\b/i,
    /\bmedicament/i,
    /\bordonnance\b/i,
    /\brgpd\b/i,
    /\bdonnees personnelles\b/i,
    /\bsupprimer mon compte\b/i,
    /\bdroit (a|à) l'oubli\b/i,
    /\bmineur\b/i,
    /\bpregnan/i,
    /\ballergic\b/i,
    /\bgdpr\b/i,
  ],
  spam: [
    /\bgagne[rz]? de l'argent\b/i,
    /\bcrypto(monnaie)?\b.*\binvestis/i,
    /\bfollow ?back\b/i,
    /\bcheck my (profile|page|bio)\b/i,
    /\bdm me for\b/i,
    /\bfree followers?\b/i,
    /\bbit\.ly\//i,
    /\bt\.me\//i,
    /\bwhatsapp \+\d{6,}/i,
  ],
};

/** Retire les diacritiques pour que les motifs sans accent matchent quand même. */
function deaccent(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export type TriageResult = {
  locale: SupportedLocale;
  languageConfidence: number;
  flags: ModerationFlag[];
  /** Haute dès qu'un signalement est présent. */
  priority: "normal" | "high";
  /**
   * Vrai si la conversation ne doit jamais partir sans lecture humaine.
   * Identique à « au moins un signalement », mais nommé pour que l'intention
   * reste lisible à l'appel.
   */
  requiresHumanReview: boolean;
};

export function triageMessage(
  text: string,
  fallbackLocale: SupportedLocale = "fr",
): TriageResult {
  const language = detectLanguage(text, fallbackLocale);
  const haystack = deaccent(text);

  const flags = (Object.keys(FLAG_PATTERNS) as ModerationFlag[]).filter((flag) =>
    FLAG_PATTERNS[flag].some((pattern) => pattern.test(haystack)),
  );

  return {
    locale: language.locale,
    languageConfidence: language.confidence,
    flags,
    priority: flags.length > 0 ? "high" : "normal",
    requiresHumanReview: flags.length > 0,
  };
}
