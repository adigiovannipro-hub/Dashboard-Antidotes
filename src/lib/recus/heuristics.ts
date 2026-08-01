/**
 * Tri de premier passage, avant tout appel à un modèle.
 *
 * Une boîte reçoit des centaines de mails par semaine dont une poignée sont des
 * pièces comptables. Faire lire chacun d'eux par un modèle coûterait cher pour
 * répondre « non » quatre-vingt-quinze fois sur cent. Ces règles écartent
 * l'évident et ne tranchent jamais le douteux : leur seul rôle est de décider
 * *qui mérite d'être lu*.
 *
 * Rien ici n'est spécifique à un fournisseur. Une liste de marchands connus
 * vieillirait mal et raterait le prochain outil auquel on s'abonne ; ce sont les
 * mots de la comptabilité qu'on cherche, pas les noms des entreprises.
 *
 * Module pur : aucune entrée/sortie, entièrement testable.
 */

/** Mots qui font d'un mail un candidat. Français et anglais mêlés — les reçus
 *  d'outils américains arrivent en anglais dans une boîte française. */
const ACCOUNTING_TERMS = [
  // Français
  "facture",
  "facturation",
  "reçu",
  "recu",
  "quittance",
  "paiement",
  "payé",
  "prélèvement",
  "abonnement",
  "renouvellement",
  "montant",
  "total ttc",
  "total ht",
  "tva",
  "échéance",
  "note de frais",
  "bon de commande",
  // Anglais
  "invoice",
  "receipt",
  "billing",
  "billed",
  "payment",
  "paid",
  "charged",
  "subscription",
  "renewal",
  "order confirmation",
  "amount due",
  "total due",
  "vat",
  "tax invoice",
  "statement",
];

/** Termes qui, seuls, ne prouvent rien mais renforcent un candidat. */
const SUPPORTING_TERMS = [
  "commande",
  "order",
  "transaction",
  "carte",
  "card",
  "référence",
  "reference",
  "numéro de facture",
  "invoice number",
  "download",
  "télécharger",
];

/**
 * Termes qui trahissent un mail commercial déguisé en facture.
 *
 * « Votre facture vous attend » d'un démarcheur porte les mêmes mots qu'une
 * vraie facture. Ces marqueurs-là ne se trouvent que dans le premier cas.
 */
const PROMOTIONAL_TERMS = [
  "offre spéciale",
  "special offer",
  "promotion",
  "réduction",
  "discount code",
  "webinar",
  "webinaire",
  "newsletter",
  "essai gratuit",
  "free trial",
  "découvrez",
  "inscrivez-vous",
  "register now",
  "black friday",
  "soldes",
];

export type TriageVerdict =
  /** Aucun signe comptable : classé sans suite, sans appel au modèle. */
  | "skip"
  /** Assez de signes pour valoir une lecture attentive. */
  | "inspect";

export type TriageInput = {
  subject: string | null;
  from_email: string;
  snippet: string | null;
  /** Corps texte du mail, tronqué si besoin par l'appelant. */
  body?: string | null;
  /** Noms des pièces jointes, extensions comprises. */
  attachmentNames?: string[];
};

export type TriageResult = {
  verdict: TriageVerdict;
  /** Entre 0 et 1. Sert à ordonner, pas à décider seul. */
  score: number;
  /** Phrases affichables, dans l'ordre où elles ont pesé. */
  reasons: string[];
};

const PDF_NAME = /\.pdf$/i;

/** Domaine de l'expéditeur, en minuscules, sans le sous-domaine d'envoi. */
export function senderDomain(email: string): string {
  const at = email.lastIndexOf("@");
  if (at === -1) return email.trim().toLowerCase();
  const host = email.slice(at + 1).trim().toLowerCase().replace(/[>,;]+$/, "");

  /* Les fournisseurs envoient depuis `billing.stripe.com`, `mail.notion.so`,
     `email.grab.com`… Ne garder que les deux derniers segments regroupe ces
     variantes sous une seule règle, ce qui est exactement ce qu'on veut quand
     l'utilisateur dit « toujours accepter ce fournisseur ». */
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return host;

  /* Sauf pour les suffixes composés, où deux segments ne suffisent pas :
     `example.co.uk` deviendrait `co.uk`, qui n'identifie personne. */
  const COMPOUND_SUFFIXES = new Set([
    "co.uk", "org.uk", "ac.uk", "gov.uk",
    "com.au", "net.au", "org.au",
    "co.jp", "co.nz", "com.br", "com.sg", "com.hk",
  ]);
  const lastTwo = parts.slice(-2).join(".");
  return COMPOUND_SUFFIXES.has(lastTwo)
    ? parts.slice(-3).join(".")
    : lastTwo;
}

function countMatches(haystack: string, terms: string[]): string[] {
  return terms.filter((term) => haystack.includes(term));
}

/**
 * Décide si un mail mérite d'être lu par le modèle.
 *
 * Le seuil est volontairement bas. Une facture ratée coûte le geste manuel
 * qu'on cherchait à supprimer ; un mail inspecté pour rien coûte une fraction
 * de centime. L'asymétrie doit se voir dans le réglage.
 */
export function triageEmail(input: TriageInput): TriageResult {
  const haystack = [
    input.subject ?? "",
    input.snippet ?? "",
    input.body ?? "",
    (input.attachmentNames ?? []).join(" "),
  ]
    .join("\n")
    .toLowerCase();

  const reasons: string[] = [];
  let score = 0;

  const accounting = countMatches(haystack, ACCOUNTING_TERMS);
  if (accounting.length > 0) {
    // Plafonné : trouver dix fois « facture » ne rend pas le mail dix fois plus
    // probable, c'est souvent le signe d'un pied de page verbeux.
    score += Math.min(accounting.length, 3) * 0.2;
    reasons.push(`Vocabulaire comptable : ${accounting.slice(0, 3).join(", ")}`);
  }

  const supporting = countMatches(haystack, SUPPORTING_TERMS);
  if (supporting.length > 0) {
    score += Math.min(supporting.length, 2) * 0.05;
  }

  const pdfNames = (input.attachmentNames ?? []).filter((name) =>
    PDF_NAME.test(name),
  );
  if (pdfNames.length > 0) {
    score += 0.3;
    reasons.push(`PDF joint : ${pdfNames[0]}`);
  }

  const amounts = extractAmounts(haystack);
  if (amounts.length > 0) {
    score += 0.25;
    const first = amounts[0]!;
    reasons.push(`Montant repéré : ${formatAmount(first.cents, first.currency)}`);
  }

  const promotional = countMatches(haystack, PROMOTIONAL_TERMS);
  if (promotional.length > 0) {
    /* Pénalité franche mais non éliminatoire : un vrai reçu peut porter une
       ligne « découvrez nos nouveautés » en pied de page. */
    score -= 0.3;
    reasons.push(`Tournures commerciales : ${promotional.slice(0, 2).join(", ")}`);
  }

  const normalized = Math.max(0, Math.min(1, score));

  /* Un PDF joint accompagné d'un montant suffit à faire lire le mail, même sans
     le mot « facture » — beaucoup de reçus n'écrivent que « Votre commande ». */
  const worthReading =
    accounting.length > 0 || (pdfNames.length > 0 && amounts.length > 0);

  return {
    verdict: worthReading && normalized >= 0.2 ? "inspect" : "skip",
    score: Number(normalized.toFixed(3)),
    reasons,
  };
}

// --- Montants ---------------------------------------------------------------

export type ParsedAmount = {
  /** En centimes : aucun montant ne transite en flottant. */
  cents: number;
  /** Code ISO sur trois lettres. */
  currency: string;
};

const SYMBOL_TO_CURRENCY: Record<string, string> = {
  "€": "EUR",
  $: "USD",
  "£": "GBP",
  "¥": "JPY",
  "₹": "INR",
  "₩": "KRW",
  "₫": "VND",
  "฿": "THB",
  "₱": "PHP",
  "S$": "SGD",
  "RM": "MYR",
  "Rp": "IDR",
};

const KNOWN_CODES = new Set([
  "EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD", "NZD", "SGD", "HKD",
  "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "RON", "BGN", "TRY", "ZAR",
  "CNY", "INR", "IDR", "MYR", "THB", "VND", "PHP", "KRW", "AED", "BRL", "MXN",
]);

/* Un nombre à séparateurs : « 1 234,56 », « 1,234.56 », « 12.00 », « 1.234,56 ».
   Le groupe de tête tolère l'espace fine insécable des locales françaises. */
const NUMBER = String.raw`\d{1,3}(?:[   .,]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?`;

const SYMBOL_CLASS = "[€$£¥₹₩₫฿₱]";

const AMOUNT_PATTERNS: RegExp[] = [
  // Symbole devant : « €12,50 », « $1,234.56 »
  new RegExp(String.raw`(${SYMBOL_CLASS})\s?(${NUMBER})`, "g"),
  // Symbole derrière : « 12,50 € »
  new RegExp(String.raw`(${NUMBER})\s?(${SYMBOL_CLASS})`, "g"),
  // Code devant : « EUR 12.50 »
  new RegExp(String.raw`\b([a-z]{3})\s(${NUMBER})\b`, "gi"),
  // Code derrière : « 12,50 EUR »
  new RegExp(String.raw`(${NUMBER})\s([a-z]{3})\b`, "gi"),
];

/**
 * Convertit la partie numérique d'un montant en centimes.
 *
 * Le point dur est le séparateur décimal : « 1.234 » vaut mille deux cent
 * trente-quatre en France et un virgule deux trois quatre aux États-Unis. La
 * règle retenue — le dernier séparateur est le décimal s'il est suivi d'un ou
 * deux chiffres — tranche correctement les deux cas sans connaître la locale.
 */
export function parseAmountToCents(raw: string): number | null {
  const cleaned = raw.replace(/[\s  ]/g, "");
  if (!/\d/.test(cleaned)) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const lastSeparator = Math.max(lastComma, lastDot);

  let integerPart = cleaned;
  let decimalPart = "";

  if (lastSeparator !== -1) {
    const tail = cleaned.slice(lastSeparator + 1);
    if (tail.length === 1 || tail.length === 2) {
      integerPart = cleaned.slice(0, lastSeparator);
      decimalPart = tail.padEnd(2, "0");
    }
  }

  const digits = integerPart.replace(/[.,]/g, "");
  if (!/^\d+$/.test(digits)) return null;

  const cents = Number(digits) * 100 + Number(decimalPart || "0");
  return Number.isSafeInteger(cents) ? cents : null;
}

/**
 * Tous les montants d'un texte, dans l'ordre d'apparition, dédoublonnés.
 *
 * L'ordre n'est pas anodin : sur un reçu, le total est rarement le premier
 * montant cité, mais c'est presque toujours le plus élevé. L'appelant décide.
 */
export function extractAmounts(text: string): ParsedAmount[] {
  const found: ParsedAmount[] = [];
  const seen = new Set<string>();

  for (const pattern of AMOUNT_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      const [, first, second] = match;
      if (!first || !second) continue;

      // Selon le motif, le nombre est en première ou en seconde position.
      const numeric = /\d/.test(first) ? first : second;
      const token = numeric === first ? second : first;

      const currency =
        SYMBOL_TO_CURRENCY[token] ??
        (KNOWN_CODES.has(token.toUpperCase()) ? token.toUpperCase() : null);
      if (!currency) continue;

      const cents = parseAmountToCents(numeric);
      if (cents === null || cents === 0) continue;

      const key = `${cents}:${currency}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ cents, currency });
    }
  }

  return found;
}

/**
 * Le montant le plus probable d'un reçu : le plus élevé de la devise dominante.
 *
 * Prendre le premier trouvé donnerait le sous-total ou le prix unitaire ; le
 * total est le plus grand nombre du document dans la quasi-totalité des cas.
 */
export function likelyTotal(amounts: ParsedAmount[]): ParsedAmount | null {
  if (amounts.length === 0) return null;

  const byCurrency = new Map<string, ParsedAmount[]>();
  for (const amount of amounts) {
    const list = byCurrency.get(amount.currency) ?? [];
    list.push(amount);
    byCurrency.set(amount.currency, list);
  }

  let dominant: ParsedAmount[] = [];
  for (const list of byCurrency.values()) {
    if (list.length > dominant.length) dominant = list;
  }

  return dominant.reduce((max, current) =>
    current.cents > max.cents ? current : max,
  );
}

export function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
