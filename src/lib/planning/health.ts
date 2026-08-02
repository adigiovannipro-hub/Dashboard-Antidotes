/**
 * Santé de production d'un mois.
 *
 * La cadence dit si le planning est *bien construit* ; la santé dit s'il est
 * *prêt à partir*. Deux questions différentes, posées à des moments différents :
 * la première en fin de planification, la seconde tous les matins.
 *
 * Le critère est toujours la proximité de la date de publication. Un wording
 * manquant sur un contenu du 28 est normal le 2 ; le même wording manquant le
 * 27 est un problème. La sévérité suit donc l'échéance, pas la nature du
 * manque.
 */

import { DONE_STATUSES, READY_STATUSES, hasWording, isPlanned } from "./types";
import type { PlanningStatus, ProducibleSubject } from "./types";

export type GapCode =
  | "overdue"
  | "not_validated"
  | "wording_missing"
  | "visual_missing";

export type GapSeverity = "info" | "warning" | "critical";

export type ProductionGap = {
  code: GapCode;
  severity: GapSeverity;
  message: string;
  subjectIds: string[];
};

export type MonthHealth = {
  /** Publications du mois, hors « non retenu ». */
  total: number;
  published: number;
  ready: number;
  /** Part de publications publiées ou prêtes à partir, entre 0 et 1. */
  completion: number;
  gaps: ProductionGap[];
  /** Prochaine publication à sortir. */
  nextUp: ProducibleSubject | null;
};

export type HealthOptions = {
  asOf: Date;
  /** Délai avant publication à partir duquel un contenu doit être validé. */
  validationLeadDays?: number;
};

const DEFAULT_LEAD_DAYS = 3;

function today(asOf: Date): string {
  return asOf.toISOString().slice(0, 10);
}

function daysUntil(date: string, asOf: Date): number {
  const target = Date.parse(`${date}T00:00:00Z`);
  const now = Date.parse(`${today(asOf)}T00:00:00Z`);
  return Math.round((target - now) / 86_400_000);
}

function isDone(status: PlanningStatus): boolean {
  return DONE_STATUSES.includes(status);
}

function isReady(status: PlanningStatus): boolean {
  return READY_STATUSES.includes(status);
}

export function assessMonth(
  subjects: ProducibleSubject[],
  options: HealthOptions,
): MonthHealth {
  const leadDays = options.validationLeadDays ?? DEFAULT_LEAD_DAYS;
  const planned = subjects.filter((subject) => isPlanned(subject.status));
  const gaps: ProductionGap[] = [];

  const add = (
    code: GapCode,
    severity: GapSeverity,
    message: string,
    matched: ProducibleSubject[],
  ) => {
    if (matched.length > 0) {
      gaps.push({ code, severity, message, subjectIds: matched.map((s) => s.id) });
    }
  };

  // Une date d'hier et toujours pas publié : soit c'est parti sans que le
  // tableau suive, soit c'est passé à la trappe. Les deux méritent un œil.
  add(
    "overdue",
    "critical",
    "Date passée, toujours pas publié",
    planned.filter(
      (subject) =>
        subject.scheduled_on !== null &&
        subject.scheduled_on < today(options.asOf) &&
        !isDone(subject.status),
    ),
  );

  const imminent = planned.filter(
    (subject) =>
      subject.scheduled_on !== null &&
      !isDone(subject.status) &&
      daysUntil(subject.scheduled_on, options.asOf) >= 0 &&
      daysUntil(subject.scheduled_on, options.asOf) <= leadDays,
  );

  add(
    "not_validated",
    "critical",
    `Publication sous ${leadDays} jours sans validation`,
    imminent.filter((subject) => !isReady(subject.status)),
  );

  add(
    "wording_missing",
    imminent.some((subject) => !hasWording(subject)) ? "critical" : "warning",
    "Wording à écrire",
    planned.filter((subject) => !isDone(subject.status) && !hasWording(subject)),
  );

  add(
    "visual_missing",
    imminent.some((subject) => subject.visual_urls.length === 0)
      ? "critical"
      : "warning",
    "Visuel manquant",
    planned.filter(
      (subject) => !isDone(subject.status) && subject.visual_urls.length === 0,
    ),
  );

  const published = planned.filter((subject) => isDone(subject.status));
  const ready = planned.filter((subject) => isReady(subject.status));

  return {
    total: planned.length,
    published: published.length,
    ready: ready.length,
    completion:
      planned.length === 0 ? 0 : (published.length + ready.length) / planned.length,
    gaps: gaps.sort((a, b) => severityRank(b.severity) - severityRank(a.severity)),
    nextUp: findNextUp(planned, options.asOf),
  };
}

function severityRank(severity: GapSeverity): number {
  return severity === "critical" ? 2 : severity === "warning" ? 1 : 0;
}

function findNextUp(
  subjects: ProducibleSubject[],
  asOf: Date,
): ProducibleSubject | null {
  const upcoming = subjects
    .filter(
      (subject) =>
        subject.scheduled_on !== null &&
        subject.scheduled_on >= today(asOf) &&
        !isDone(subject.status),
    )
    .sort((a, b) => a.scheduled_on!.localeCompare(b.scheduled_on!));

  return upcoming[0] ?? null;
}
