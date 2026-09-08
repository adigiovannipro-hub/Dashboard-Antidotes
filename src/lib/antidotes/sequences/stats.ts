/**
 * Les chiffres d'une séquence, calculés au rendu à partir des inscriptions et
 * du journal — on stocke les envois et les réponses, jamais un taux.
 *
 * Et la garde des rebonds : au-delà de 3 % de rebonds, un domaine d'envoi
 * bascule durablement en spam. La garde ne juge qu'à partir d'un volume
 * minimal — un rebond sur trois envois n'est pas un signal, c'est un
 * accident — et elle **arrête** les envois plutôt que de les ralentir.
 */

import type { EnrollmentStatus } from "../types";

export type SequenceCounts = {
  enrolled: number;
  active: number;
  paused: number;
  completed: number;
  stoppedOnReply: number;
  stoppedOnOptOut: number;
  linkedin: number;
  sent: number;
  replied: number;
  bounced: number;
  /** Inscriptions ayant reçu au moins un envoi — la base du taux de réponse. */
  contacted: number;
  /** Réponses rapportées aux inscriptions ayant reçu au moins un envoi ; `null` sans envoi. */
  replyRate: number | null;
};

export type EnrollmentLike = { status: EnrollmentStatus; channel: "email" | "linkedin" | "none" };
export type InteractionLike = { type: string };

export function computeSequenceCounts(
  enrollments: EnrollmentLike[],
  interactions: InteractionLike[],
  /** Inscriptions ayant reçu au moins un envoi — la base du taux de réponse. */
  contacted: number,
): SequenceCounts {
  const count = (status: EnrollmentStatus) => enrollments.filter((e) => e.status === status).length;
  const sent = interactions.filter((i) => i.type === "email_sent").length;
  const replied = interactions.filter((i) => i.type === "reply").length;
  const bounced = interactions.filter((i) => i.type === "bounce").length;
  return {
    enrolled: enrollments.length,
    active: count("active"),
    paused: count("paused"),
    completed: count("completed"),
    stoppedOnReply: count("stopped_on_reply"),
    stoppedOnOptOut: count("stopped_on_opt_out"),
    linkedin: enrollments.filter((e) => e.channel === "linkedin").length,
    sent,
    replied,
    bounced,
    contacted,
    replyRate: contacted > 0 ? replied / contacted : null,
  };
}

export const BOUNCE_RATE_LIMIT = 0.03;
/** En dessous de vingt envois, un rebond ne dit rien du domaine. */
export const BOUNCE_GUARD_MIN_SENT = 20;

export type BounceGuard = {
  sent: number;
  bounced: number;
  rate: number | null;
  /** Vrai quand plus rien ne doit partir. */
  blocked: boolean;
};

export function evaluateBounceGuard(sent: number, bounced: number): BounceGuard {
  const rate = sent > 0 ? bounced / sent : null;
  return {
    sent,
    bounced,
    rate,
    blocked: sent >= BOUNCE_GUARD_MIN_SENT && rate !== null && rate > BOUNCE_RATE_LIMIT,
  };
}

const RATE = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });

/** `0.333` → « 33 % » ; `null` → « — ». Un taux de réponse n'a pas besoin de décimales. */
export function formatRate(rate: number | null): string {
  return rate === null || !Number.isFinite(rate) ? "—" : RATE.format(rate);
}
