import type { ExtractionResult } from "./extraction-prompt";
import { senderDomain } from "./heuristics";

/**
 * Lecture sans modèle des reçus dont la forme ne varie jamais.
 *
 * Grab est le premier fournisseur en volume — une à trois courses par jour — et
 * son e-reçu est un gabarit fixe : « TOTAL Rp 211700 », puis la date au format
 * « 25 Sep 26 14:17 +0800 ». Le faire lire par le modèle coûtait un appel par
 * course, et le 25/09 l'épuisement du crédit Anthropic a laissé les courses du
 * jour sans lecture, donc sans envoi.
 *
 * Cette lecture passe outre le plafond de confiance des heuristiques — c'est
 * délibéré et borné : elle ne rend quelque chose que si **chaque** champ se lit
 * sans ambiguïté, et les deux totaux du reçu doivent concorder. Au moindre
 * écart, elle rend `null` et le modèle reprend la main. L'auto-transfert garde
 * ses autres verrous : fournisseur automatisé, dépense carte au même montant.
 */
export function parseKnownReceipt(email: {
  subject: string | null;
  from_email: string;
  snippet: string | null;
  text: string;
}): ExtractionResult | null {
  if (senderDomain(email.from_email) !== "grab.com") return null;
  return parseGrabReceipt(email);
}

/** Mois abrégés tels que Grab les écrit, en anglais comme en indonésien. */
const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  mei: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  agu: 8,
  agt: 8,
  sep: 9,
  oct: 10,
  okt: 10,
  nov: 11,
  dec: 12,
  des: 12,
};

export function parseGrabReceipt(email: {
  subject: string | null;
  snippet: string | null;
  text: string;
}): ExtractionResult | null {
  if (!/e-?receipt/i.test(email.subject ?? "")) return null;

  const haystack = [email.snippet ?? "", email.text].join("\n");

  /* Le total d'en-tête et le « TOTAL (INCL. TAX) » du détail : les deux
     doivent dire la même chose, sinon on ne sait pas lequel croire. Les
     séparateurs du texte (tirets, barres de tableau) varient selon le rendu. */
  const totals = [
    ...haystack.matchAll(/\bTOTAL(?:\s*\(INCL\.?\s*TAX\))?[\s|:]*Rp\s*([\d.,]+)/gi),
  ].map((match) => rupiahCents(match[1]));
  if (totals.length === 0 || totals.some((total) => total === null)) return null;
  const amount = totals[0];
  if (amount === null || totals.some((total) => total !== amount)) return null;

  const date = haystack.match(
    /\b(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2})\s+\d{1,2}:\d{2}\s*[+-]\d{4}\b/,
  );
  if (!date) return null;
  const day = Number(date[1]);
  const month = MONTHS[date[2].toLowerCase()];
  const year = 2000 + Number(date[3]);
  if (!month || day < 1 || day > 31) return null;
  const documentDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return {
    kind: "receipt",
    confidence: 0.95,
    reason: `E-reçu Grab lu par règle dédiée : Rp ${amount / 100} le ${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}.`,
    merchant: "Grab",
    amount_cents: amount,
    currency: "IDR",
    tax_cents: null,
    document_date: documentDate,
    invoice_number: null,
    source: "heuristics",
    prompt_version: null,
  };
}

/**
 * La roupie n'a pas de décimales à l'affichage : « 211.700 », « 211,700 » et
 * « 211700 » valent tous 211 700. Convention du module, `cents = montant × 100`.
 */
function rupiahCents(raw: string): number | null {
  const trimmed = raw.replace(/[.,]+$/, "");
  if (!/^\d{1,3}([.,]\d{3})*$|^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed.replace(/[.,]/g, ""));
  return value > 0 ? value * 100 : null;
}
