/**
 * Le mois lu par le Reporting.
 *
 * Un rapport se lit **par mois révolu** : le 14 août, le mois qui a du sens
 * est juillet — août n'est pas fini, ses chiffres bougeront encore et un
 * client comparerait deux semaines à un mois entier.
 *
 * Tout en UTC, comme partout : un mois qui commencerait à minuit heure de
 * Paris décalerait les bornes d'agrégation d'une journée deux fois par an.
 */

/** Clé d'un mois, `YYYY-MM`. C'est elle qui voyage dans l'URL. */
export type MonthKey = string;

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

export function monthKey(date: Date): MonthKey {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Le dernier mois entièrement écoulé. En août, juillet. */
export function lastCompleteMonth(now: Date): MonthKey {
  return monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
}

/** `2026-07` → « juillet 2026 ». */
export function monthLabel(key: MonthKey): string {
  const [year, month] = key.split("-").map(Number);
  const name = MONTHS[(month ?? 1) - 1];
  return name ? `${name} ${year}` : key;
}

/** Le mois d'avant, pour la comparaison affichée sous les chiffres. */
export function previousMonth(key: MonthKey): MonthKey {
  const [year, month] = key.split("-").map(Number);
  return monthKey(new Date(Date.UTC(year ?? 1970, (month ?? 1) - 2, 1)));
}

/**
 * Les mois proposés au choix : du dernier révolu en remontant.
 *
 * Le mois en cours n'y figure pas — il n'est pas comparable, et l'afficher
 * ferait croire à une chute chaque début de mois.
 */
export function monthOptions(now: Date, count = 12): MonthKey[] {
  const options: MonthKey[] = [];
  for (let back = 1; back <= count; back += 1) {
    options.push(
      monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1))),
    );
  }
  return options;
}

/** Le mois demandé par l'URL, s'il est valide et pas dans le futur. */
export function parseMonth(raw: string | undefined, now: Date): MonthKey | null {
  if (!raw || !/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) return null;
  return raw <= monthKey(now) ? raw : null;
}

/** Les deux bornes d'un mois, incluses, au format `date` de Postgres. */
export function monthBounds(key: MonthKey): { from: string; to: string } {
  const [year, month] = key.split("-").map(Number);
  const start = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, 1));
  const end = new Date(Date.UTC(year ?? 1970, month ?? 1, 0));
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

/* --- Plage libre ------------------------------------------------------------
   Le mois révolu reste le défaut, mais un rapport se demande aussi sur « les
   30 derniers jours » ou sur deux semaines précises. La plage est donc la
   forme canonique, et le mois n'en est qu'un préréglage. */

export type DateRange = { from: string; to: string };

export type RangePreset =
  | "mois-dernier"
  | "mois-en-cours"
  | "7-jours"
  | "30-jours"
  | "90-jours"
  | "personnalise";

export const RANGE_PRESET_LABELS: Record<RangePreset, string> = {
  "mois-dernier": "Le mois dernier",
  "mois-en-cours": "Le mois en cours",
  "7-jours": "7 derniers jours",
  "30-jours": "30 derniers jours",
  "90-jours": "90 derniers jours",
  personnalise: "Personnalisé",
};

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Les bornes d'un préréglage. `personnalise` n'en a pas : c'est la saisie. */
export function presetRange(preset: RangePreset, now: Date): DateRange | null {
  if (preset === "mois-dernier") return monthBounds(lastCompleteMonth(now));
  if (preset === "mois-en-cours") return monthBounds(monthKey(now));
  if (preset === "personnalise") return null;

  const days = preset === "7-jours" ? 7 : preset === "30-jours" ? 30 : 90;
  // La veille comme borne haute : aujourd'hui n'est pas fini, l'inclure ferait
  // baisser chaque indicateur à mesure qu'on consulte tôt dans la journée.
  const to = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1),
  );
  const from = new Date(
    Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate() - days + 1),
  );
  return { from: isoDay(from), to: isoDay(to) };
}

/** Le préréglage qui correspond à une plage, ou « Personnalisé ». */
export function presetOf(range: DateRange, now: Date): RangePreset {
  for (const preset of [
    "mois-dernier",
    "mois-en-cours",
    "7-jours",
    "30-jours",
    "90-jours",
  ] as const) {
    const candidate = presetRange(preset, now);
    if (candidate && candidate.from === range.from && candidate.to === range.to) {
      return preset;
    }
  }
  return "personnalise";
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** La plage demandée par l'URL, bornes remises dans l'ordre si besoin. */
export function parseRange(
  from: string | undefined,
  to: string | undefined,
): DateRange | null {
  if (!from || !to || !ISO_DAY.test(from) || !ISO_DAY.test(to)) return null;
  // Une plage à l'envers est une faute de frappe, pas une plage vide : on la
  // remet à l'endroit plutôt que de rendre zéro ligne sans rien dire.
  return from <= to ? { from, to } : { from: to, to: from };
}
