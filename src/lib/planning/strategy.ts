/**
 * Déduction de la stratégie éditoriale depuis l'historique.
 *
 * Le cas courant, chez la plupart des clients : aucun document de stratégie
 * n'existe. Le rythme réel est pourtant parfaitement lisible dans ce qui a été
 * publié les mois précédents — nombre de contenus, répartition des formats,
 * jours de publication, budgets de sponsorisation, templates récurrents.
 *
 * Deux précautions qui font toute la différence entre un chiffre utile et un
 * chiffre trompeur :
 *
 *   • **médiane, pas moyenne** — un mois de lancement à douze contenus ne doit
 *     pas faire croire que le rythme habituel est de douze ;
 *   • **mois complets uniquement** — le mois en cours et les mois à venir sont
 *     encore en cours de remplissage ; les compter tirerait toutes les cibles
 *     vers le bas.
 */

import { normalizeLabel } from "./monday-mapping";
import type {
  PlanningClient,
  PlanningFormat,
  PlanningPlatform,
  StrategyOverride,
  SubjectWithLane,
} from "./types";
import { isPlanned } from "./types";

export type FormatShare = {
  format: PlanningFormat;
  /** Médiane du nombre de contenus de ce format par mois. */
  perMonth: number;
  /** Part dans le mix, entre 0 et 1. */
  share: number;
};

export type TemplateUsage = {
  /** Nom normalisé, numéro de série retiré : « CAPSULE 1 » et « CAPSULE 2 »
      comptent pour un même template. */
  template: string;
  uses: number;
  /** Dernier mois où il a servi, `YYYY-MM-01`. */
  lastUsedMonth: string;
};

export type PlatformStrategy = {
  platform: PlanningPlatform;
  /** Volume mensuel de référence (médiane des mois complets). */
  monthlyTarget: number;
  monthsObserved: number;
  formatMix: FormatShare[];
  /** Histogramme des jours de publication, index 0 = dimanche. */
  weekdayHistogram: number[];
  sponsoringMedian: number | null;
  templates: TemplateUsage[];
};

export type DeducedStrategy = {
  /** `declared` : stratégie renseignée à la main, elle prime sur l'historique. */
  source: "declared" | "history" | "none";
  /** Mois complets pris en compte, du plus ancien au plus récent. */
  monthsObserved: string[];
  platforms: PlatformStrategy[];
};

export type DeduceOptions = {
  /** Date de référence : tout mois qui la contient ou lui est postérieur est
      considéré comme incomplet et écarté. */
  asOf: Date;
  /** Profondeur d'analyse. Trois mois suffisent à voir un rythme, au-delà on
      capte surtout des changements de stratégie passés. */
  lookbackMonths?: number;
};

const DEFAULT_LOOKBACK = 3;

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/** `YYYY-MM-01` du mois qui contient la date. */
export function monthKeyOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Nom de sujet → template.
 *
 * Les déclinaisons d'un même template se numérotent (« CAPSULE 1 »,
 * « MOMENTS BONDET 2 ») : le numéro final est retiré pour que la rotation se
 * mesure sur le template, pas sur ses épisodes.
 */
export function templateKey(name: string): string {
  return normalizeLabel(name)
    .replace(/\s+\d+$/, "")
    .replace(/\s+[-–]\s*$/, "")
    .trim();
}

/** Jour de la semaine d'une date `YYYY-MM-DD`, 0 = dimanche. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/**
 * Stratégie déclarée du client, si elle existe, convertie au même format que la
 * déduction pour que l'interface n'ait qu'un seul type à afficher.
 */
function fromOverride(override: StrategyOverride): DeducedStrategy {
  const platforms: PlatformStrategy[] = Object.entries(override.platforms).map(
    ([platform, config]) => {
      const mix = Object.entries(config?.format_mix ?? {}) as [
        PlanningFormat,
        number,
      ][];
      const total = mix.reduce((sum, [, count]) => sum + count, 0);

      return {
        platform: platform as PlanningPlatform,
        monthlyTarget: config?.monthly_target ?? 0,
        monthsObserved: 0,
        formatMix: mix
          .map(([format, perMonth]) => ({
            format,
            perMonth,
            share: total > 0 ? perMonth / total : 0,
          }))
          .sort((a, b) => b.perMonth - a.perMonth),
        weekdayHistogram: Array<number>(7).fill(0),
        sponsoringMedian: null,
        templates: [],
      };
    },
  );

  return { source: "declared", monthsObserved: [], platforms };
}

/**
 * Déduit la stratégie d'un client à partir de ses sujets passés.
 *
 * `subjects` doit couvrir plusieurs mois : c'est l'appelant qui décide de la
 * fenêtre chargée, cette fonction ne fait que la découper.
 */
export function deduceStrategy(
  subjects: SubjectWithLane[],
  options: DeduceOptions,
): DeducedStrategy {
  const currentMonth = monthKeyOf(options.asOf);
  const lookback = options.lookbackMonths ?? DEFAULT_LOOKBACK;

  // Un sujet non retenu n'a jamais existé pour le lecteur : il ne doit peser ni
  // sur le volume, ni sur le mix.
  const planned = subjects.filter((subject) => isPlanned(subject.status));

  // Les mois complets, du plus récent au plus ancien, puis on garde la fenêtre.
  const completeMonths = [
    ...new Set(planned.map((subject) => monthOf(subject))),
  ]
    .filter((month) => month < currentMonth)
    .sort()
    .slice(-lookback);

  if (completeMonths.length === 0) {
    return { source: "none", monthsObserved: [], platforms: [] };
  }

  const inWindow = planned.filter((subject) =>
    completeMonths.includes(monthOf(subject)),
  );

  const platforms = [...new Set(inWindow.map((subject) => subject.platform))];

  return {
    source: "history",
    monthsObserved: completeMonths,
    platforms: platforms
      .map((platform) =>
        buildPlatformStrategy(
          platform,
          inWindow.filter((subject) => subject.platform === platform),
          completeMonths,
        ),
      )
      .sort((a, b) => b.monthlyTarget - a.monthlyTarget),
  };
}

function monthOf(subject: SubjectWithLane): string {
  // `scheduled_on` fait foi quand elle existe : c'est la date de publication
  // réelle. Le groupe Monday sert de repli pour les sujets non datés.
  return subject.scheduled_on
    ? `${subject.scheduled_on.slice(0, 7)}-01`
    : subject.month_key;
}

function buildPlatformStrategy(
  platform: PlanningPlatform,
  subjects: SubjectWithLane[],
  months: string[],
): PlatformStrategy {
  // Compte par mois, en incluant explicitement les mois à zéro : une plateforme
  // animée un mois sur deux a bien une médiane basse, et c'est l'information.
  const countsByMonth = months.map(
    (month) => subjects.filter((subject) => monthOf(subject) === month).length,
  );

  const formats = [...new Set(subjects.map((subject) => subject.format))];
  const formatMedians = formats.map((format) => {
    const perMonth = months.map(
      (month) =>
        subjects.filter(
          (subject) => monthOf(subject) === month && subject.format === format,
        ).length,
    );
    return { format, perMonth: median(perMonth) ?? 0 };
  });

  const mixTotal = formatMedians.reduce((sum, entry) => sum + entry.perMonth, 0);

  const weekdayHistogram = Array<number>(7).fill(0);
  for (const subject of subjects) {
    if (subject.scheduled_on) {
      weekdayHistogram[weekdayOf(subject.scheduled_on)]! += 1;
    }
  }

  const budgets = subjects
    .map((subject) => subject.sponsoring)
    .filter((value): value is number => value !== null && value > 0);

  return {
    platform,
    monthlyTarget: Math.round(median(countsByMonth) ?? 0),
    monthsObserved: months.length,
    formatMix: formatMedians
      .map((entry) => ({
        ...entry,
        share: mixTotal > 0 ? entry.perMonth / mixTotal : 0,
      }))
      .sort((a, b) => b.perMonth - a.perMonth),
    weekdayHistogram,
    sponsoringMedian: median(budgets),
    templates: buildTemplates(subjects),
  };
}

function buildTemplates(subjects: SubjectWithLane[]): TemplateUsage[] {
  const byTemplate = new Map<string, { uses: number; lastUsedMonth: string }>();

  for (const subject of subjects) {
    const key = templateKey(subject.name);
    if (!key) continue;
    const month = monthOf(subject);
    const existing = byTemplate.get(key);
    if (existing) {
      existing.uses += 1;
      if (month > existing.lastUsedMonth) existing.lastUsedMonth = month;
    } else {
      byTemplate.set(key, { uses: 1, lastUsedMonth: month });
    }
  }

  return [...byTemplate.entries()]
    .map(([template, usage]) => ({ template, ...usage }))
    .sort((a, b) => b.uses - a.uses || a.template.localeCompare(b.template));
}

/**
 * La stratégie qui fait autorité pour un client : la sienne si elle est
 * déclarée, sinon celle que dit l'historique.
 */
export function resolveStrategy(
  client: Pick<PlanningClient, "strategy_override">,
  subjects: SubjectWithLane[],
  options: DeduceOptions,
): DeducedStrategy {
  if (client.strategy_override) return fromOverride(client.strategy_override);
  return deduceStrategy(subjects, options);
}

export function platformStrategy(
  strategy: DeducedStrategy,
  platform: PlanningPlatform,
): PlatformStrategy | null {
  return (
    strategy.platforms.find((entry) => entry.platform === platform) ?? null
  );
}
