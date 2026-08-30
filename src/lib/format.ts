import { METRIC_DEFINITIONS } from "@/lib/metrics/definitions";
import type { MetricFormat, MetricId } from "@/lib/metrics/types";

const LOCALE = "fr-FR";

/** Affiché quand une métrique n'est pas définie (dénominateur nul). */
export const NOT_AVAILABLE = "—";

const formatters: Record<MetricFormat, Intl.NumberFormat> = {
  integer: new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }),
  decimal: new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
  currency: new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
  // `Intl` en fr-FR insère déjà l'espace insécable avant le %.
  percent: new Intl.NumberFormat(LOCALE, {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
  ratio: new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
};

export function formatValue(value: number | null, format: MetricFormat): string {
  if (value === null || !Number.isFinite(value)) return NOT_AVAILABLE;
  return formatters[format].format(value);
}

export function formatMetric(id: MetricId, value: number | null): string {
  return formatValue(value, METRIC_DEFINITIONS[id].format);
}

/** Variation relative signée : `0.1346` → « +134,6 % ». */
export function formatDelta(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return "N/A";
  const formatted = new Intl.NumberFormat(LOCALE, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(ratio);
  return formatted;
}

/**
 * Formate les grands nombres en version compacte pour les axes de graphiques
 * (`2777` → « 2,8 k »), afin de ne pas saturer les graduations.
 */
/**
 * Un nombre saisi à la main, rendu lisible au repos — séparateurs de milliers
 * français, décimales conservées si elles existent. Sans devise : une colonne
 * de nombres du planning peut compter des euros comme des unités, et inventer
 * un symbole serait affirmer ce qu'on ne sait pas.
 */
const plainNumber = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });

export function formatPlainNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "";
  return plainNumber.format(value);
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat(LOCALE, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Une durée en secondes, rendue `hh:mm:ss` — la forme du rapport Looker
 * (« 00:00:30 »), reprise à l'identique pour que le client retrouve sa
 * lecture. Les secondes s'arrondissent : personne ne lit une session au
 * dixième.
 */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return NOT_AVAILABLE;
  }
  const whole = Math.round(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = whole % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(rest)}`;
}

const octets = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });

/** Taille d'un fichier : `1234567` → « 1,2 Mo ». */
export function formatOctets(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return NOT_AVAILABLE;
  if (bytes < 1024) return `${octets.format(bytes)} o`;

  const units = ["Ko", "Mo", "Go"] as const;
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${octets.format(value)} ${units[unit]}`;
}

// --- Dates saisies ----------------------------------------------------------

/**
 * Le format d'une date qu'on tape, par opposition à celle qu'on lit.
 *
 * `<input type="date">` affiche la date dans la langue du **navigateur**, pas
 * dans celle de la page : le même écran montre 05/08/2026 à Paris et
 * 08/05/2026 à New York, sans rien pour les distinguer. Un champ où la date se
 * saisit doit donc rendre lui-même son texte.
 *
 * Le pivot reste l'ISO `AAAA-MM-JJ`, celui de l'URL et de la base ; le
 * français ne vit que dans le champ.
 */

const DAY_FR = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/** `"2026-08-05"` → `"05/08/2026"`. Chaîne vide si l'entrée n'est pas une date. */
export function formatDayFr(iso: string | null | undefined): string {
  if (!iso) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return "";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/**
 * `"05/08/2026"` → `"2026-08-05"`, `null` si la date n'existe pas.
 *
 * Le contrôle est calendaire, pas seulement syntaxique : `31/02/2026` a la
 * bonne forme et n'est pas une date. Le tour par `Date.UTC` puis la relecture
 * des composantes est ce qui l'attrape — un 31 février se range en 3 mars, et
 * la comparaison échoue.
 */
export function parseDayFr(text: string): string | null {
  const match = DAY_FR.exec(text.trim());
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

/**
 * Pose les barres obliques au fil de la frappe : `0508` → `05/08`.
 *
 * Sans elle, il faut taper les séparateurs, et une saisie au pavé numérique
 * devient un exercice. Les caractères non chiffrés sont écartés, la longueur
 * est plafonnée à huit chiffres.
 */
export function maskDayFr(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * Une durée en minutes, en français : `45 min`, `1 h 05`, `8 h`.
 *
 * Sert aux leçons de l'Academy — la somme d'un module, la durée d'une vidéo.
 * `formatDuration` (secondes, `hh:mm:ss`) reste la forme du Reporting Web.
 * Une durée absente s'affiche `—`, jamais `0 min` : zéro serait une mesure.
 */
export function formatMinutes(minutes: number | null): string {
  if (minutes === null || minutes <= 0) return NOT_AVAILABLE;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${String(rest).padStart(2, "0")}`;
}
