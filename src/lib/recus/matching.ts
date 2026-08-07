/**
 * Rapprochement d'une pièce et d'une dépense carte.
 *
 * Ce que ce calcul fait, et surtout ce qu'il ne fait pas : il **ne range pas**
 * la pièce. C'est l'OCR d'Airwallex qui décide, de son côté, à quelle
 * transaction accrocher un reçu reçu par mail — aucune API publique ne permet
 * de le lui imposer. Ce score sert à deux choses, l'une avant l'autre :
 *
 *   1. avant l'envoi, savoir si la pièce est assez sûre pour partir sans qu'on
 *      la regarde, et montrer sur quelle ligne on parie ;
 *   2. après l'envoi, savoir quelle ligne surveiller pour confirmer que la
 *      pièce s'est bien accrochée là où on l'attendait.
 *
 * Trois signaux, par ordre de fiabilité décroissante : le montant, la date, le
 * nom du marchand. Le montant domine parce qu'il est le seul à être reproduit
 * à l'identique des deux côtés ; le libellé d'une carte bancaire, lui, est un
 * champ de bataille d'abréviations.
 *
 * Module pur : aucune entrée/sortie, entièrement testable.
 */

import type { MatchCandidate, ReceiptMatchMethod } from "./types";

export type MatchableDocument = {
  amount_cents: number | null;
  currency: string | null;
  /** Date portée par la pièce ; à défaut, celle de réception du mail. */
  document_date: string | null;
  received_at: string;
  merchant: string | null;
};

export type MatchableExpense = {
  id: string;
  /** Montant local — celui que portent les reçus. */
  amount_cents: number;
  currency: string;
  /** Le débité du wallet, quand Airwallex l'a fixé. Une pièce peut être
      libellée d'un côté comme de l'autre : un e-reçu Grab parle en IDR, une
      facture d'abonnement européenne parle en EUR. */
  billing_amount_cents: number | null;
  billing_currency: string | null;
  transaction_date: string | null;
  posted_at: string | null;
  merchant: string | null;
  attachment_count: number;
};

export type MatchResult = {
  best: MatchCandidate | null;
  /** Classés par confiance décroissante, le meilleur en tête. */
  candidates: MatchCandidate[];
  /**
   * Deux candidats trop proches pour être départagés.
   *
   * Cas réel et fréquent : deux courses le même jour au même prix. Le score ne
   * peut pas trancher, et deviner reviendrait à ranger une pièce sur la
   * mauvaise ligne — l'erreur exactement qu'on cherche à ne pas commettre.
   */
  ambiguous: boolean;
};

/** Au-delà, la transaction est trop loin dans le temps pour être la bonne. */
const MAX_DAY_GAP = 15;

/** Écart de montant toléré : le plus permissif des deux critères s'applique. */
const AMOUNT_TOLERANCE_RATIO = 0.02;
const AMOUNT_TOLERANCE_CENTS = 100;

/** En dessous, un candidat n'est pas montré : ce serait du bruit. */
const MIN_REPORTED_CONFIDENCE = 0.35;

/** Écart minimal entre les deux premiers pour considérer le duel tranché. */
const AMBIGUITY_MARGIN = 0.08;

const MAX_CANDIDATES = 5;

// --- Normalisation des libellés ---------------------------------------------

/** Formes juridiques et mentions de plateforme, sans valeur discriminante. */
const NOISE_TOKENS = new Set([
  "sas", "sarl", "sa", "sasu", "eurl", "sci", "scop",
  "inc", "llc", "ltd", "limited", "corp", "corporation", "co",
  "gmbh", "ag", "bv", "nv", "ab", "oy", "as",
  "pte", "pty", "plc", "kk", "srl", "spa",
  "the", "and", "et",
]);

/**
 * Préfixes que les réseaux bancaires collent devant le vrai marchand.
 *
 * `SQ *CAFE`, `PAYPAL *NOTION`, `AMZN MKTP FR` : le nom utile est derrière. Les
 * retirer avant comparaison change tout — sans cela, deux marchands sans aucun
 * rapport passés par le même prestataire se ressemblent davantage que le même
 * marchand vu depuis un mail et depuis une carte.
 */
const DESCRIPTOR_PREFIXES = [
  /^sq\s*\*/i,
  /^sp\s*\*/i,
  /^tst\*/i,
  /^paypal\s*\*/i,
  /^pp\s*\*/i,
  /^stripe\s*\*/i,
  /^amzn\s+mktp/i,
  /^apple\.com\/bill/i,
  /^google\s*\*/i,
  /^wl\s*\*/i,
];

export function normalizeMerchant(raw: string | null): string {
  if (!raw) return "";

  let value = raw.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  for (const prefix of DESCRIPTOR_PREFIXES) {
    value = value.replace(prefix, " ");
  }

  return value
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token.length > 1 && !NOISE_TOKENS.has(token))
    // Les libellés de carte se terminent souvent par une ville ou un pays sur
    // deux ou trois lettres, et par des numéros de terminal.
    .filter((token) => !/^\d+$/.test(token))
    .join(" ")
    .trim();
}

function bigrams(value: string): Set<string> {
  const set = new Set<string>();
  const compact = value.replace(/\s+/g, "");
  for (let index = 0; index < compact.length - 1; index += 1) {
    set.add(compact.slice(index, index + 2));
  }
  return set;
}

/**
 * Similarité de Dice sur les bigrammes, entre 0 et 1.
 *
 * Préférée à une distance d'édition : elle reste élevée quand un mot est
 * ajouté ou retiré (« Notion » contre « Notion Labs »), ce qui est la
 * différence la plus courante entre un nom de marchand et un libellé de carte.
 */
export function similarity(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;

  // Une inclusion nette vaut mieux qu'un score dilué par la longueur.
  if (left.includes(right) || right.includes(left)) return 0.9;

  const a = bigrams(left);
  const b = bigrams(right);
  if (a.size === 0 || b.size === 0) return 0;

  let shared = 0;
  for (const gram of a) if (b.has(gram)) shared += 1;

  return (2 * shared) / (a.size + b.size);
}

// --- Comparaisons élémentaires ----------------------------------------------

function daysBetween(left: Date, right: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.abs(Math.round((left.getTime() - right.getTime()) / MS_PER_DAY));
}

function documentDate(document: MatchableDocument): Date {
  return new Date(document.document_date ?? document.received_at);
}

function expenseDate(expense: MatchableExpense): Date | null {
  const raw = expense.transaction_date ?? expense.posted_at;
  return raw ? new Date(raw) : null;
}

type Score = { value: number; reason: string } | null;

/** Les montants d'une dépense, dans l'ordre où on les confronte à la pièce :
    le local d'abord — c'est lui que portent les reçus — puis le débité. */
function expenseAmounts(
  expense: MatchableExpense,
): { cents: number; currency: string }[] {
  const pairs = [{ cents: expense.amount_cents, currency: expense.currency }];
  if (
    expense.billing_amount_cents !== null &&
    expense.billing_currency !== null &&
    expense.billing_currency !== expense.currency
  ) {
    pairs.push({
      cents: expense.billing_amount_cents,
      currency: expense.billing_currency,
    });
  }
  return pairs;
}

function scoreAmount(
  document: MatchableDocument,
  expense: MatchableExpense,
): Score {
  if (document.amount_cents === null) {
    /* Sans montant, on ne disqualifie pas : la date et le marchand peuvent
       encore désigner une ligne. Mais on n'accorde aucun crédit non plus, et le
       plafond de confiance qui en résulte empêchera tout envoi automatique. */
    return { value: 0, reason: "Montant absent de la pièce" };
  }

  /* La pièce se compare au montant de la **même devise** : un e-reçu Grab en
     IDR se confronte aux 154 400 IDR facturés, une facture en EUR au débit
     EUR. Rien n'est jamais converti — si aucune devise ne coïncide, comparer
     les nombres n'aurait aucun sens, et appliquer un taux de change deviné en
     aurait encore moins. */
  const comparable = expenseAmounts(expense).filter(
    (pair) => !document.currency || document.currency === pair.currency,
  );
  if (comparable.length === 0) return null;

  let best: Score = null;
  for (const pair of comparable) {
    const gap = Math.abs(document.amount_cents - pair.cents);

    let candidate: Score = null;
    if (gap === 0) {
      candidate = { value: 0.55, reason: "Montant identique" };
    } else {
      const tolerance = Math.max(
        AMOUNT_TOLERANCE_CENTS,
        Math.round(pair.cents * AMOUNT_TOLERANCE_RATIO),
      );
      if (gap <= tolerance) {
        // Frais de service, arrondi, pourboire : l'écart est plausible.
        candidate = { value: 0.4, reason: "Montant proche" };
      }
    }

    if (candidate && (!best || candidate.value > best.value)) best = candidate;
  }

  return best;
}

function scoreDate(document: MatchableDocument, expense: MatchableExpense): Score {
  const theirs = expenseDate(expense);
  if (!theirs) return { value: 0, reason: "Date de transaction inconnue" };

  const gap = daysBetween(documentDate(document), theirs);
  if (gap > MAX_DAY_GAP) return null;

  if (gap === 0) return { value: 0.25, reason: "Même jour" };
  if (gap <= 2) return { value: 0.2, reason: `À ${gap} jour${gap > 1 ? "s" : ""}` };
  if (gap <= 5) return { value: 0.12, reason: `À ${gap} jours` };
  return { value: 0.04, reason: `À ${gap} jours` };
}

function scoreMerchant(
  document: MatchableDocument,
  expense: MatchableExpense,
): Score {
  const ours = normalizeMerchant(document.merchant);
  const theirs = normalizeMerchant(expense.merchant);
  if (!ours || !theirs) return { value: 0, reason: "Marchand non comparable" };

  const ratio = similarity(ours, theirs);
  if (ratio >= 0.8) return { value: 0.2, reason: "Marchand identique" };
  if (ratio >= 0.5) return { value: 0.12, reason: "Marchand proche" };
  if (ratio >= 0.3) return { value: 0.04, reason: "Marchand vaguement proche" };

  /* Marchands franchement différents. On ne disqualifie pas — « CB PARIS 1234 »
     ne ressemble à rien de lisible — mais on retire de la confiance. */
  return { value: -0.1, reason: "Marchand différent" };
}

// --- Rapprochement -----------------------------------------------------------

export function matchDocument(
  document: MatchableDocument,
  expenses: MatchableExpense[],
): MatchResult {
  const scored: MatchCandidate[] = [];

  for (const expense of expenses) {
    const amount = scoreAmount(document, expense);
    if (!amount) continue;

    const date = scoreDate(document, expense);
    if (!date) continue;

    const merchant = scoreMerchant(document, expense);
    if (!merchant) continue;

    let confidence = amount.value + date.value + merchant.value;

    /* Une ligne qui porte déjà une pièce jointe est probablement rangée. Elle
       reste candidate — un reçu peut légitimement en compléter un autre — mais
       elle cède la place à une ligne encore nue à score comparable. */
    if (expense.attachment_count > 0) confidence -= 0.05;

    /* Sans montant exploitable, la date et le nom seuls ne feront jamais une
       certitude. Le plafond le dit explicitement plutôt que de laisser
       l'addition produire un score flatteur. */
    if (document.amount_cents === null) confidence = Math.min(confidence, 0.5);

    const rounded = Number(Math.max(0, Math.min(1, confidence)).toFixed(3));
    if (rounded < MIN_REPORTED_CONFIDENCE) continue;

    const method: ReceiptMatchMethod =
      amount.reason === "Montant identique" && date.value >= 0.2
        ? "exact"
        : "fuzzy";

    scored.push({
      expense_id: expense.id,
      confidence: rounded,
      method,
      reason: [amount.reason, date.reason, merchant.reason]
        .filter((part) => part && !part.includes("non comparable"))
        .join(" · "),
    });
  }

  scored.sort((left, right) => right.confidence - left.confidence);

  const candidates = scored.slice(0, MAX_CANDIDATES);
  const best = candidates[0] ?? null;
  const runnerUp = candidates[1];

  const ambiguous =
    best !== null &&
    runnerUp !== undefined &&
    best.confidence - runnerUp.confidence < AMBIGUITY_MARGIN;

  return { best, candidates, ambiguous };
}
