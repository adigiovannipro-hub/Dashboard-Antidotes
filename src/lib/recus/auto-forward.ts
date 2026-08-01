import type { AutoForwardSettings, ReceiptKind, ReceiptMerchantRule } from "./types";
import { isAccountable } from "./types";
import type { MatchResult } from "./matching";

/**
 * Garde-fous de l'auto-transfert.
 *
 * Désactivé par défaut. Ce module est la seule porte : rien ne quitte la boîte
 * mail sans passer par `evaluateAutoForward`, et la fonction refuse par défaut —
 * chaque autorisation est explicite.
 *
 * Ce qui se joue ici est plus lourd que dans la modération : un transfert
 * envoie un vrai mail depuis votre adresse, et une pièce rangée sur la mauvaise
 * ligne de frais fausse une comptabilité sans que rien ne le signale. D'où deux
 * exclusions non configurables :
 *
 *   • **l'ambiguïté**. Deux dépenses au même montant le même jour, et le score
 *     ne sait pas laquelle. Deviner à pile ou face serait pire que de demander.
 *
 *   • **le fournisseur inconnu**. Un domaine jamais validé à la main ne part
 *     jamais seul, quelle que soit la confiance affichée. L'automatisme se
 *     mérite fournisseur par fournisseur, et c'est vous qui l'accordez.
 */

export type AutoForwardRefusal =
  | "disabled"
  | "emergency_stop"
  | "not_accountable"
  | "below_confidence"
  | "no_expense_match"
  | "ambiguous_match"
  | "amount_above_cap"
  | "merchant_not_trusted"
  | "sender_ignored"
  | "hourly_cap_reached"
  | "already_decided";

export const REFUSAL_LABELS: Record<AutoForwardRefusal, string> = {
  disabled: "Auto-transfert désactivé",
  emergency_stop: "Arrêt d'urgence activé",
  not_accountable: "Pièce sans valeur comptable",
  below_confidence: "Confiance sous le seuil configuré",
  no_expense_match: "Aucune dépense carte correspondante",
  ambiguous_match: "Plusieurs dépenses également plausibles",
  amount_above_cap: "Montant au-dessus du plafond automatique",
  merchant_not_trusted: "Fournisseur pas encore approuvé pour l'automatisme",
  sender_ignored: "Expéditeur mis de côté",
  hourly_cap_reached: "Plafond horaire atteint",
  already_decided: "Pièce déjà traitée",
};

export type AutoForwardDecision =
  | {
      allowed: true;
      rule: { confidence: number; expenseId: string | null; domain: string };
    }
  | { allowed: false; refusals: AutoForwardRefusal[] };

export type AutoForwardContext = {
  settings: AutoForwardSettings;
  document: {
    kind: ReceiptKind;
    classification_confidence: number;
    amount_cents: number | null;
    status: string;
  };
  match: MatchResult;
  /** Règle du domaine expéditeur, si elle existe déjà. */
  rule: Pick<ReceiptMerchantRule, "auto_forward"> | null;
  senderDomain: string;
  ignoredSenders: string[];
  /** Transferts automatiques déjà effectués dans l'heure glissante. */
  autoForwardedLastHour: number;
};

/**
 * Renvoie **toutes** les raisons de refus, pas seulement la première.
 *
 * Quelqu'un qui s'étonne que rien ne parte tout seul a besoin de la liste
 * complète pour savoir quoi corriger, pas d'un jeu de piste où chaque réglage
 * change en révèle un autre.
 */
export function evaluateAutoForward(
  context: AutoForwardContext,
): AutoForwardDecision {
  const {
    settings,
    document,
    match,
    rule,
    senderDomain,
    ignoredSenders,
    autoForwardedLastHour,
  } = context;

  const refusals: AutoForwardRefusal[] = [];

  if (!settings.enabled) refusals.push("disabled");
  if (settings.emergency_stop) refusals.push("emergency_stop");

  // --- Exclusions systématiques, non configurables ---
  if (!isAccountable(document.kind)) refusals.push("not_accountable");
  if (match.ambiguous) refusals.push("ambiguous_match");
  if (!rule?.auto_forward) refusals.push("merchant_not_trusted");
  if (document.status !== "awaiting_validation") refusals.push("already_decided");

  // --- Réglages ---
  /* La confiance retenue est la plus basse des deux : reconnaître à coup sûr
     une facture ne sert à rien si l'on ne sait pas à quelle dépense elle se
     rapporte, et l'inverse est vrai aussi. */
  const confidence = effectiveConfidence(
    document.classification_confidence,
    match.best?.confidence ?? null,
    settings.require_expense_match,
  );
  if (confidence < settings.min_confidence) refusals.push("below_confidence");

  if (settings.require_expense_match && !match.best) {
    refusals.push("no_expense_match");
  }

  if (
    document.amount_cents !== null &&
    document.amount_cents > settings.max_amount_cents
  ) {
    refusals.push("amount_above_cap");
  }

  if (ignoredSenders.includes(senderDomain)) refusals.push("sender_ignored");
  if (autoForwardedLastHour >= settings.hourly_cap) {
    refusals.push("hourly_cap_reached");
  }

  if (refusals.length > 0) return { allowed: false, refusals };

  return {
    allowed: true,
    rule: {
      confidence,
      expenseId: match.best?.expense_id ?? null,
      domain: senderDomain,
    },
  };
}

/**
 * Confiance globale d'une pièce : le maillon le plus faible.
 *
 * Quand le rapprochement n'est pas exigé, l'absence de dépense correspondante
 * ne pénalise pas — mais un rapprochement *présent et mauvais* pénalise
 * toujours, parce qu'il signale une pièce dont l'histoire ne tient pas.
 */
export function effectiveConfidence(
  classification: number,
  match: number | null,
  requireMatch: boolean,
): number {
  if (match === null) return requireMatch ? 0 : classification;
  return Math.min(classification, match);
}

/**
 * Faut-il proposer d'automatiser ce fournisseur ?
 *
 * On ne le propose qu'après des validations manuelles répétées et sans refus
 * récent : une seule pièce refusée sur un domaine suffit à retirer la
 * proposition, parce que c'est le signal que le cas n'est pas aussi routinier
 * qu'il en avait l'air.
 */
export function shouldSuggestAutomation(
  rule: Pick<ReceiptMerchantRule, "approvals" | "rejections" | "auto_forward">,
  threshold: number,
): boolean {
  if (rule.auto_forward) return false;
  if (rule.rejections > 0) return false;
  return rule.approvals >= threshold;
}
