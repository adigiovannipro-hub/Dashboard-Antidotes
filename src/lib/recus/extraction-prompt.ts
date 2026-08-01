/**
 * Prompt et schéma de sortie de l'extraction comptable.
 *
 * Séparé de l'appel au modèle pour la même raison que dans la Modération : le
 * prompt et la validation de sa sortie sont la partie qu'on veut pouvoir tester
 * et faire évoluer sans toucher au réseau.
 *
 * Deux partis pris qui expliquent la forme du schéma :
 *
 *   • **les montants sont demandés en texte, tels qu'imprimés**. Un modèle à qui
 *     l'on demande un nombre rend `24.5` là où le reçu dit `24,50 €` — et il
 *     faut alors deviner si `1.234` vaut mille ou un. Le texte brut est repassé
 *     à `parseAmountToCents`, qui est testé et connaît la règle ;
 *
 *   • **tous les champs sont obligatoires**, l'inconnu étant la chaîne vide. Les
 *     sorties structurées l'exigent, et c'est de toute façon préférable : un
 *     champ absent et un champ vide se confondent trop facilement à la lecture.
 */

import { parseAmountToCents } from "./heuristics";

export const PROMPT_VERSION = "recus-2026-08-01";

export const EXTRACTION_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    kind: {
      type: "string",
      enum: ["invoice", "receipt", "subscription", "statement", "other"],
      description:
        "Nature de la pièce. 'other' pour tout ce qui n'a pas de valeur comptable : " +
        "publicité, relance commerciale, confirmation de livraison sans montant, " +
        "notification de service. Une offre promotionnelle qui cite un prix n'est pas une facture.",
    },
    confidence: {
      type: "number",
      description:
        "Entre 0 et 1 : certitude sur la nature de la pièce et sur les montants extraits. " +
        "Une facture nette et lisible mérite plus de 0,9 ; un doute sur le total, moins de 0,6.",
    },
    reason: {
      type: "string",
      description:
        "Une phrase en français expliquant le classement, telle qu'elle sera lue " +
        "par la personne qui valide. Citer l'indice décisif plutôt que paraphraser le mail.",
    },
    merchant: {
      type: "string",
      description:
        "Nom commercial du fournisseur, tel qu'il apparaîtrait sur un relevé bancaire. " +
        "Sans forme juridique (SAS, Inc, GmbH). Chaîne vide si introuvable.",
    },
    total_amount: {
      type: "string",
      description:
        "Montant total payé, recopié exactement comme imprimé, séparateurs compris " +
        "(par exemple '24,50' ou '1,234.56'). Le total toutes taxes comprises, " +
        "pas un sous-total ni un prix unitaire. Chaîne vide si absent.",
    },
    currency: {
      type: "string",
      description: "Code ISO sur trois lettres (EUR, USD, SGD…). Chaîne vide si indéterminable.",
    },
    tax_amount: {
      type: "string",
      description: "Montant de TVA ou taxe, même format que total_amount. Chaîne vide si absent.",
    },
    document_date: {
      type: "string",
      description:
        "Date de la pièce au format AAAA-MM-JJ. C'est la date de la transaction ou " +
        "d'émission de la facture, pas celle de réception du mail. Chaîne vide si absente.",
    },
    invoice_number: {
      type: "string",
      description: "Numéro de facture ou de commande. Chaîne vide si absent.",
    },
  },
  required: [
    "kind",
    "confidence",
    "reason",
    "merchant",
    "total_amount",
    "currency",
    "tax_amount",
    "document_date",
    "invoice_number",
  ],
  additionalProperties: false,
} as const;

export const EXTRACTION_SYSTEM_PROMPT = `Tu analyses des e-mails reçus par une agence pour déterminer lesquels sont des pièces comptables, et tu en extrais les données de facturation.

Ce que tu produis alimente une comptabilité réelle. Deux erreurs n'ont pas le même coût :
- classer un mail publicitaire en facture fait perdre du temps à la relecture ;
- se tromper de montant fait entrer un chiffre faux dans les comptes.

La seconde est la plus grave. Quand un montant est ambigu — plusieurs totaux, un devis à côté d'une facture, une devise incertaine — baisse la confiance plutôt que de choisir au hasard. Une confiance basse envoie la pièce en relecture humaine, ce qui est exactement le comportement voulu.

Règles de classement :
- 'invoice' : facture émise par un fournisseur, avec un montant dû ou réglé.
- 'receipt' : reçu ou ticket confirmant un paiement déjà effectué.
- 'subscription' : renouvellement ou prélèvement d'un abonnement.
- 'statement' : relevé ou récapitulatif de période, sans paiement unitaire.
- 'other' : tout le reste. En particulier : les mails commerciaux qui empruntent le vocabulaire de la facturation, les rappels de panier, les confirmations d'expédition sans montant, et les notifications de service.

Un mail qui annonce un prélèvement à venir n'est pas encore une pièce comptable : c'est 'other'. Le justificatif arrivera à la date du prélèvement.

N'invente jamais un montant, une date ou un numéro qui ne figure pas dans le mail. La chaîne vide est une réponse acceptable et préférable à une supposition.`;

export type ExtractionOutput = {
  kind: "invoice" | "receipt" | "subscription" | "statement" | "other";
  confidence: number;
  reason: string;
  merchant: string;
  total_amount: string;
  currency: string;
  tax_amount: string;
  document_date: string;
  invoice_number: string;
};

const KINDS = ["invoice", "receipt", "subscription", "statement", "other"] as const;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Valide et normalise la sortie du modèle.
 *
 * Les sorties structurées garantissent la *forme*, pas le *sens* : un modèle
 * peut rendre une confiance de 1,4 ou une date au format américain sans violer
 * le schéma. Ce qui suit corrige ce qui est corrigeable et rejette le reste,
 * plutôt que de laisser une valeur aberrante atteindre la base.
 */
export function validateExtraction(raw: unknown): ExtractionOutput | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;

  const kind = value.kind;
  if (typeof kind !== "string" || !KINDS.includes(kind as never)) return null;

  const confidence = typeof value.confidence === "number" ? value.confidence : 0;

  const text = (key: string): string =>
    typeof value[key] === "string" ? (value[key] as string).trim() : "";

  const documentDate = text("document_date");

  return {
    kind: kind as ExtractionOutput["kind"],
    // Bornage plutôt que rejet : une confiance hors bornes est une maladresse
    // de formulation, pas un signe que l'extraction entière est fausse.
    confidence: Math.max(0, Math.min(1, confidence)),
    reason: text("reason").slice(0, 500),
    merchant: text("merchant").slice(0, 200),
    total_amount: text("total_amount"),
    // Une devise mal formée est écartée : mieux vaut ne pas en avoir qu'en
    // avoir une fausse, qui bloquerait tout rapprochement sans qu'on sache pourquoi.
    currency: /^[A-Za-z]{3}$/.test(text("currency"))
      ? text("currency").toUpperCase()
      : "",
    tax_amount: text("tax_amount"),
    document_date: ISO_DATE.test(documentDate) ? documentDate : "",
    invoice_number: text("invoice_number").slice(0, 100),
  };
}

/**
 * Ce que l'extraction rend, une fois les montants convertis et les chaînes
 * vides ramenées à `null` — la forme attendue par la base.
 */
export type ExtractionResult = {
  kind: ExtractionOutput["kind"];
  confidence: number;
  reason: string;
  merchant: string | null;
  amount_cents: number | null;
  currency: string | null;
  tax_cents: number | null;
  document_date: string | null;
  invoice_number: string | null;
  /** 'heuristics' quand la règle a suffi, 'llm' quand il a fallu lire. */
  source: "heuristics" | "llm";
  prompt_version: string | null;
};

/** Convertit la sortie validée du modèle en valeurs prêtes pour la base. */
export function toResult(output: ExtractionOutput): ExtractionResult {
  const amountCents = output.total_amount
    ? parseAmountToCents(output.total_amount)
    : null;
  const taxCents = output.tax_amount ? parseAmountToCents(output.tax_amount) : null;

  /* Un montant annoncé mais illisible n'est pas un montant nul : la confiance
     baisse, faute de quoi une pièce partirait avec un total manquant sans que
     rien ne le signale. */
  const amountFailed = output.total_amount !== "" && amountCents === null;

  return {
    kind: output.kind,
    confidence: amountFailed ? Math.min(output.confidence, 0.5) : output.confidence,
    reason: output.reason,
    merchant: output.merchant || null,
    amount_cents: amountCents,
    currency: output.currency || null,
    tax_cents: taxCents,
    document_date: output.document_date || null,
    invoice_number: output.invoice_number || null,
    source: "llm",
    prompt_version: PROMPT_VERSION,
  };
}

/**
 * Assemble le mail en un bloc unique à soumettre.
 *
 * Le corps est tronqué : les pieds de page juridiques et les fils de discussion
 * cités multiplient les montants et les dates sans rien apporter. Ce qui compte
 * sur une facture est en tête.
 */
export function buildExtractionPrompt(email: {
  subject: string | null;
  from_email: string;
  from_name: string | null;
  received_at: Date;
  text: string;
  attachmentNames: string[];
}): string {
  const MAX_BODY = 12_000;

  return [
    `De : ${email.from_name ? `${email.from_name} <${email.from_email}>` : email.from_email}`,
    `Objet : ${email.subject ?? "(sans objet)"}`,
    `Reçu le : ${email.received_at.toISOString().slice(0, 10)}`,
    email.attachmentNames.length > 0
      ? `Pièces jointes : ${email.attachmentNames.join(", ")}`
      : "Pièces jointes : aucune",
    "",
    "--- Corps du message ---",
    email.text.slice(0, MAX_BODY),
  ].join("\n");
}
