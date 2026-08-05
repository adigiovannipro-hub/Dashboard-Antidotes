/**
 * Construction de la courbe d'évolution du solde à partir des instantanés
 * horaires.
 *
 * Le cron laisse un instantané par compte et par heure — quand il tourne. La
 * série affichée doit survivre à ses absences : un serveur en panne une nuit ne
 * doit pas dessiner un solde à zéro. D'où le report : à chaque point de la
 * courbe, chaque compte vaut son **dernier instantané connu**, pas celui du
 * créneau exact.
 *
 * Granularité : à 7 jours, l'heure raconte quelque chose (un virement se voit
 * l'après-midi même) ; à 30 ou 90 jours, elle ne ferait que du bruit — un point
 * par jour, pris en fin de journée.
 */

import type { ChartWindow } from "./types";

export type SeriesSnapshot = {
  account_id: string;
  available_cents: number;
  /** ISO — `snapshot_hour` en base. */
  snapshot_hour: string;
};

export type SeriesPoint = {
  /** Début du créneau, ISO. Le libellé d'axe se formate à l'affichage. */
  time: string;
  total_cents: number;
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Fenêtres où chaque heure a son point ; au-delà, un point par jour. */
const HOURLY_WINDOW_DAYS = 7;

export function buildBalanceSeries(
  snapshots: readonly SeriesSnapshot[],
  window: ChartWindow,
  now: Date = new Date(),
): SeriesPoint[] {
  if (snapshots.length === 0) return [];

  // Un tableau trié par compte : le report se lit alors d'un simple curseur
  // qui n'avance jamais en arrière, quel que soit le nombre de créneaux.
  const byAccount = new Map<string, { at: number; cents: number }[]>();
  for (const snapshot of snapshots) {
    const at = Date.parse(snapshot.snapshot_hour);
    if (Number.isNaN(at)) continue;
    const series = byAccount.get(snapshot.account_id) ?? [];
    series.push({ at, cents: snapshot.available_cents });
    byAccount.set(snapshot.account_id, series);
  }
  for (const series of byAccount.values()) {
    series.sort((a, b) => a.at - b.at);
  }

  // Chaque créneau couvre [début, début + pas) et s'étiquette à son début : le
  // créneau du jour en cours, encore partiel, vaut ainsi le dernier instantané
  // du moment — c'est ce que « aujourd'hui » veut dire sur cette courbe.
  const step = window <= HOURLY_WINDOW_DAYS ? HOUR : DAY;
  const lastBucket = alignToStep(now.getTime(), step);
  const firstBucket = lastBucket - window * DAY + step;

  const cursors = new Map<string, number>();
  const points: SeriesPoint[] = [];

  for (let bucket = firstBucket; bucket <= lastBucket; bucket += step) {
    let total = 0;
    let observed = false;

    for (const [accountId, series] of byAccount) {
      let cursor = cursors.get(accountId) ?? -1;
      while (cursor + 1 < series.length && series[cursor + 1]!.at < bucket + step) {
        cursor += 1;
      }
      cursors.set(accountId, cursor);
      if (cursor >= 0) {
        total += series[cursor]!.cents;
        observed = true;
      }
    }

    // Avant le tout premier instantané, il n'y a pas de solde à montrer : un
    // zéro inventé se lirait comme une trésorerie vide.
    if (observed) {
      points.push({ time: new Date(bucket).toISOString(), total_cents: total });
    }
  }

  return points;
}

function alignToStep(timestamp: number, step: number): number {
  return Math.floor(timestamp / step) * step;
}

/**
 * Variation entre les deux bouts de la série : ce que la fenêtre a coûté ou
 * rapporté. `null` quand la série a moins de deux points — une variation d'un
 * point unique ne veut rien dire.
 */
export function seriesDelta(points: readonly SeriesPoint[]): number | null {
  if (points.length < 2) return null;
  return points.at(-1)!.total_cents - points[0]!.total_cents;
}
