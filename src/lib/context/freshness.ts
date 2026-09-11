/**
 * Fraîcheur des saisies datées du Contexte.
 *
 * Trois règles, et une seule raison d'être : une donnée périmée qui continue
 * de partir dans un prompt est pire qu'une donnée absente — le modèle la
 * traite comme vraie et personne ne sait plus d'où sort la phrase. On ne
 * l'efface pas pour autant (une donnée qui s'efface toute seule est une donnée
 * qu'on ne peut plus expliquer) : on cesse de l'injecter, et l'écran le dit.
 *
 * Module pur, sans import Supabase. Tout calcul se fait en UTC, comme partout
 * ailleurs : un mois qui commence à minuit heure de Paris décalerait le
 * verdict d'une consigne un jour sur trente.
 */

/** Au-delà, un fait sourcé porte son marqueur « à revérifier ». */
export const SOURCED_FACT_STALE_DAYS = 180;

/** Au-delà, le contexte temporel cesse d'être injecté. */
export const TEMPORAL_CONTEXT_STALE_DAYS = 30;

/** Jours pleins écoulés depuis un instant ISO. `null` si la date est illisible. */
export function daysSince(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return null;
  return Math.floor((now.getTime() - at) / 86_400_000);
}

/** Un fait vérifié il y a plus de six mois se relit avant de se réutiliser. */
export function isFactStale(verifiedOn: string | null | undefined, now: Date): boolean {
  const days = daysSince(verifiedOn, now);
  // Une date absente ou illisible n'est pas « périmée » : elle est non datée,
  // ce que l'écran dit autrement. Ne pas confondre les deux.
  if (days === null) return false;
  return days > SOURCED_FACT_STALE_DAYS;
}

/** Un rappel d'actualité de plus de trente jours n'est plus une actualité. */
export function isTemporalContextStale(
  at: string | null | undefined,
  now: Date,
): boolean {
  const days = daysSince(at, now);
  // Ici l'inverse : un contexte temporel sans date n'est rattaché à aucun
  // moment, donc il ne peut plus prétendre décrire celui-ci.
  if (days === null) return true;
  return days > TEMPORAL_CONTEXT_STALE_DAYS;
}

export type MonthlyInstructionState = "absente" | "active" | "perimee";

/**
 * La consigne du mois vise un mois et un seul. Aucun trigger ne l'efface :
 * c'est la lecture qui compare, et une consigne d'août n'est plus injectée en
 * septembre — l'écran l'affiche alors barrée, avec son bouton Effacer.
 *
 * `targetMonth` est le mois **visé par la génération** (`YYYY-MM-01`), pas le
 * mois courant : pendant septembre on prépare octobre, et c'est la consigne
 * d'octobre qui doit partir.
 */
export function monthlyInstructionState(input: {
  instruction: string | null | undefined;
  month: string | null | undefined;
  targetMonth: string | null | undefined;
}): MonthlyInstructionState {
  if (!input.instruction || input.instruction.trim().length === 0) return "absente";
  // Une consigne sans mois ne peut pas être jugée, et une consigne qu'on ne
  // sait pas juger ne part pas : c'est exactement la donnée sans fin de vie
  // que la colonne `monthly_instruction_month` existe pour empêcher.
  if (!input.month) return "perimee";
  if (!input.targetMonth) return "perimee";
  return input.month.slice(0, 7) === input.targetMonth.slice(0, 7) ? "active" : "perimee";
}

/** Premier jour du mois d'un instant, en UTC — la forme stockée en base. */
export function firstDayOfMonth(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}-01`;
}
