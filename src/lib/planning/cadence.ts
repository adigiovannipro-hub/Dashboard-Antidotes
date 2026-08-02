/**
 * Contrôle de cadence d'un mois.
 *
 * Les règles d'équilibre éditorial — alternance des formats, couverture du
 * mois, rotation des templates — sont ici du code exécuté sur les données
 * réelles, et non des consignes qu'on espère voir respectées. Chaque anomalie
 * porte les identifiants des sujets concernés : l'interface surligne les
 * contenus fautifs, elle ne se contente pas d'un message.
 *
 * Le ton est délibérément celui d'un signalement, pas d'une interdiction. Un
 * Reel le dimanche parce que c'est le jour du Grand Prix est un bon choix ; le
 * module le mentionne, il ne le refuse pas.
 */

import { platformStrategy, templateKey, weekdayOf } from "./strategy";
import type { DeducedStrategy } from "./strategy";
import type { PlanningFormat, PlanningPlatform, SubjectWithLane } from "./types";
import { FORMAT_LABELS, NO_REPEAT_FORMATS, PLATFORM_LABELS, isPlanned } from "./types";

export type CadenceCode =
  | "undated"
  | "weekend"
  | "consecutive_format"
  | "coverage_gap"
  | "month_edges"
  | "volume_off_target"
  | "format_mix_off"
  | "template_repeat";

export type CadenceSeverity = "info" | "warning";

export type CadenceIssue = {
  code: CadenceCode;
  severity: CadenceSeverity;
  platform: PlanningPlatform;
  message: string;
  subjectIds: string[];
};

export type CadenceOptions = {
  /** Au-delà, deux publications sont trop espacées. */
  maxGapDays?: number;
  /** Marge tolérée en début et en fin de mois. */
  edgeToleranceDays?: number;
  /** Écart relatif toléré sur le volume mensuel. */
  volumeTolerance?: number;
};

const DEFAULTS = {
  maxGapDays: 7,
  edgeToleranceDays: 5,
  volumeTolerance: 0.2,
} as const;

export function daysInMonth(month: string): number {
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7));
  return new Date(Date.UTC(year, index, 0)).getUTCDate();
}

function dayOfMonth(date: string): number {
  return Number(date.slice(8, 10));
}

/** Semaine du mois, 1 à 5 — la granularité à laquelle tourne un template. */
export function weekOfMonth(date: string): number {
  return Math.floor((dayOfMonth(date) - 1) / 7) + 1;
}

function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

function isWeekend(date: string): boolean {
  const day = weekdayOf(date);
  return day === 0 || day === 6;
}

export function analyseCadence(input: {
  /** Mois analysé, `YYYY-MM-01`. */
  month: string;
  subjects: SubjectWithLane[];
  /** Mois précédent, pour la rotation des templates. */
  previousSubjects?: SubjectWithLane[];
  strategy?: DeducedStrategy | null;
  options?: CadenceOptions;
}): CadenceIssue[] {
  const options = { ...DEFAULTS, ...input.options };
  const planned = input.subjects.filter((subject) => isPlanned(subject.status));
  const issues: CadenceIssue[] = [];

  const platforms = [...new Set(planned.map((subject) => subject.platform))];

  for (const platform of platforms) {
    const subjects = planned.filter((subject) => subject.platform === platform);
    issues.push(
      ...analysePlatform({
        month: input.month,
        platform,
        subjects,
        previousSubjects: (input.previousSubjects ?? []).filter(
          (subject) => subject.platform === platform && isPlanned(subject.status),
        ),
        strategy: input.strategy ?? null,
        options,
      }),
    );
  }

  // Les avertissements d'abord : ce sont eux qui appellent une décision.
  return issues.sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "warning" ? -1 : 1,
  );
}

function analysePlatform(input: {
  month: string;
  platform: PlanningPlatform;
  subjects: SubjectWithLane[];
  previousSubjects: SubjectWithLane[];
  strategy: DeducedStrategy | null;
  options: Required<CadenceOptions>;
}): CadenceIssue[] {
  const { month, platform, subjects, previousSubjects, strategy, options } = input;
  const issues: CadenceIssue[] = [];
  const label = PLATFORM_LABELS[platform];

  const add = (
    code: CadenceCode,
    severity: CadenceSeverity,
    message: string,
    subjectIds: string[],
  ) => issues.push({ code, severity, platform, message, subjectIds });

  // --- Sujets sans date ---
  const undated = subjects.filter((subject) => !subject.scheduled_on);
  if (undated.length > 0) {
    add(
      "undated",
      "warning",
      undated.length === 1
        ? `${label} : un contenu n'a pas de date.`
        : `${label} : ${undated.length} contenus n'ont pas de date.`,
      undated.map((subject) => subject.id),
    );
  }

  const dated = subjects
    .filter(
      (subject): subject is SubjectWithLane & { scheduled_on: string } =>
        subject.scheduled_on !== null,
    )
    .sort((a, b) => a.scheduled_on.localeCompare(b.scheduled_on));

  // --- Week-end ---
  const weekend = dated.filter((subject) => isWeekend(subject.scheduled_on));
  if (weekend.length > 0) {
    add(
      "weekend",
      "info",
      weekend.length === 1
        ? `${label} : une publication tombe un week-end.`
        : `${label} : ${weekend.length} publications tombent un week-end.`,
      weekend.map((subject) => subject.id),
    );
  }

  // --- Formats consécutifs ---
  for (let index = 1; index < dated.length; index += 1) {
    const previous = dated[index - 1]!;
    const current = dated[index]!;
    if (
      previous.format === current.format &&
      NO_REPEAT_FORMATS.includes(current.format)
    ) {
      add(
        "consecutive_format",
        "warning",
        `${label} : deux ${FORMAT_LABELS[current.format]}s à la suite ` +
          `(${formatDay(previous.scheduled_on)} puis ${formatDay(current.scheduled_on)}).`,
        [previous.id, current.id],
      );
    }
  }

  // --- Trous de couverture ---
  for (let index = 1; index < dated.length; index += 1) {
    const previous = dated[index - 1]!;
    const current = dated[index]!;
    const gap = daysBetween(previous.scheduled_on, current.scheduled_on);
    if (gap > options.maxGapDays) {
      add(
        "coverage_gap",
        "warning",
        `${label} : ${gap} jours sans publication entre le ` +
          `${formatDay(previous.scheduled_on)} et le ${formatDay(current.scheduled_on)}.`,
        [previous.id, current.id],
      );
    }
  }

  // --- Bords du mois ---
  if (dated.length > 0) {
    const first = dated[0]!;
    const last = dated[dated.length - 1]!;
    const lastDay = daysInMonth(month);

    if (dayOfMonth(first.scheduled_on) > options.edgeToleranceDays + 1) {
      add(
        "month_edges",
        "info",
        `${label} : le mois ne démarre que le ${formatDay(first.scheduled_on)}.`,
        [first.id],
      );
    }
    if (dayOfMonth(last.scheduled_on) < lastDay - options.edgeToleranceDays) {
      add(
        "month_edges",
        "info",
        `${label} : plus rien après le ${formatDay(last.scheduled_on)}.`,
        [last.id],
      );
    }
  }

  // --- Volume et mix, comparés à la stratégie ---
  const target = strategy ? platformStrategy(strategy, platform) : null;

  if (target && target.monthlyTarget > 0) {
    const tolerance = Math.max(1, target.monthlyTarget * options.volumeTolerance);
    const delta = subjects.length - target.monthlyTarget;

    if (Math.abs(delta) > tolerance) {
      add(
        "volume_off_target",
        "warning",
        `${label} : ${subjects.length} contenus contre ${target.monthlyTarget} ` +
          `habituellement (${delta > 0 ? "+" : ""}${delta}).`,
        subjects.map((subject) => subject.id),
      );
    }

    for (const expected of target.formatMix) {
      if (expected.perMonth < 1) continue;
      const actual = subjects.filter(
        (subject) => subject.format === expected.format,
      );
      const gap = actual.length - expected.perMonth;
      if (Math.abs(gap) > 1) {
        add(
          "format_mix_off",
          "info",
          `${label} : ${actual.length} ${FORMAT_LABELS[expected.format]}s ` +
            `contre ${expected.perMonth} habituellement.`,
          actual.map((subject) => subject.id),
        );
      }
    }
  }

  // --- Rotation des templates ---
  // Un template replacé exactement à la même semaine que le mois précédent
  // donne au lecteur l'impression d'un planning qui se répète.
  if (previousSubjects.length > 0) {
    const previousSlots = new Set(
      previousSubjects
        .filter((subject) => subject.scheduled_on)
        .map(
          (subject) =>
            `${templateKey(subject.name)}#${weekOfMonth(subject.scheduled_on!)}`,
        ),
    );

    for (const subject of dated) {
      const key = templateKey(subject.name);
      if (!key) continue;
      if (previousSlots.has(`${key}#${weekOfMonth(subject.scheduled_on)}`)) {
        add(
          "template_repeat",
          "info",
          `${label} : « ${subject.name} » retombe en semaine ` +
            `${weekOfMonth(subject.scheduled_on)}, comme le mois dernier.`,
          [subject.id],
        );
      }
    }
  }

  return issues;
}

function formatDay(date: string): string {
  return String(dayOfMonth(date));
}

/** Sujets à surligner, tous codes confondus. */
export function flaggedSubjectIds(issues: CadenceIssue[]): Set<string> {
  const ids = new Set<string>();
  for (const issue of issues) {
    // Le volume porte sur le mois entier : surligner tous les contenus ferait
    // clignoter la vue sans rien désigner d'utile.
    if (issue.code === "volume_off_target") continue;
    for (const id of issue.subjectIds) ids.add(id);
  }
  return ids;
}

/** Formats effectivement présents dans un mois, avec leur compte. */
export function formatCounts(
  subjects: SubjectWithLane[],
): { format: PlanningFormat; count: number }[] {
  const counts = new Map<PlanningFormat, number>();
  for (const subject of subjects) {
    if (!isPlanned(subject.status)) continue;
    counts.set(subject.format, (counts.get(subject.format) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([format, count]) => ({ format, count }))
    .sort((a, b) => b.count - a.count);
}
