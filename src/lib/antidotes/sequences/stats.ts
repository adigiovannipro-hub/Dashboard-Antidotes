/**
 * Les chiffres d'une séquence, calculés au rendu à partir des inscriptions et
 * du journal — on stocke les envois et les réponses, jamais un taux.
 *
 * Et la garde des rebonds : au-delà de 3 % de rebonds, un domaine d'envoi
 * bascule durablement en spam. La garde ne juge qu'à partir d'un volume
 * minimal — un rebond sur trois envois n'est pas un signal, c'est un
 * accident — et elle **arrête** les envois plutôt que de les ralentir.
 */

import type { EnrollmentStatus, ProspectStatus } from "../types";

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
  /** Inscriptions dont la personne a répondu (`replied_at`) — des personnes, là où `replied` compte des messages. */
  responded: number;
  /** Inscriptions dont le prospect est en rendez-vous ou gagné : la dernière marche de l'entonnoir. */
  meetings: number;
  /** Réponses rapportées aux inscriptions ayant reçu au moins un envoi ; `null` sans envoi. */
  replyRate: number | null;
};

/** Un rendez-vous obtenu reste un rendez-vous une fois le client gagné. */
export const MEETING_STATUSES: readonly ProspectStatus[] = ["meeting", "won"];

export type EnrollmentLike = {
  status: EnrollmentStatus;
  channel: "email" | "linkedin" | "none";
  replied_at?: string | null;
  /** Le statut du prospect derrière le contact inscrit, quand la lecture l'a joint. */
  prospect_status?: ProspectStatus | null;
};
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
    responded: enrollments.filter((e) => Boolean(e.replied_at)).length,
    meetings: enrollments.filter((e) => e.prospect_status != null && MEETING_STATUSES.includes(e.prospect_status)).length,
    replyRate: contacted > 0 ? replied / contacted : null,
  };
}

/** La somme des compteurs de plusieurs séquences — le taux est recalculé sur les agrégats, jamais moyenné. */
export function sumSequenceCounts(list: readonly SequenceCounts[]): SequenceCounts {
  const sum: SequenceCounts = {
    enrolled: 0,
    active: 0,
    paused: 0,
    completed: 0,
    stoppedOnReply: 0,
    stoppedOnOptOut: 0,
    linkedin: 0,
    sent: 0,
    replied: 0,
    bounced: 0,
    contacted: 0,
    responded: 0,
    meetings: 0,
    replyRate: null,
  };
  for (const counts of list) {
    for (const key of Object.keys(sum) as (keyof SequenceCounts)[]) {
      if (key === "replyRate") continue;
      sum[key] += counts[key];
    }
  }
  sum.replyRate = sum.contacted > 0 ? sum.replied / sum.contacted : null;
  return sum;
}

export type SequenceFunnelStep = {
  key: "enrolled" | "contacted" | "responded" | "meetings";
  label: string;
  value: number;
  /** Le taux de passage depuis la marche précédente : 1 sur la première, `null` quand la précédente est à zéro. */
  passage: number | null;
};

const FUNNEL_STEPS: readonly [SequenceFunnelStep["key"], string][] = [
  ["enrolled", "Inscrits"],
  ["contacted", "Contactés"],
  ["responded", "Ont répondu"],
  ["meetings", "Rendez-vous"],
];

/**
 * Les quatre marches de l'entonnoir d'une séquence, toutes en personnes :
 * « 9 inscrits, 10 envoyés » mélangeait des gens et des messages, et ne
 * voulait rien dire. Les messages restent en information secondaire.
 */
export function buildSequenceFunnel(counts: SequenceCounts): SequenceFunnelStep[] {
  return FUNNEL_STEPS.map(([key, label], index) => {
    const value = counts[key];
    const previous = index === 0 ? null : counts[FUNNEL_STEPS[index - 1][0]];
    return {
      key,
      label,
      value,
      passage: previous === null ? 1 : previous > 0 ? value / previous : null,
    };
  });
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
