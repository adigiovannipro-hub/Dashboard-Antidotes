/**
 * Préférences d'affichage mémorisées dans un cookie.
 *
 * Ni `"use client"`, ni `import "server-only"` : ce module est lu des deux
 * côtés, et c'est tout son intérêt. Une constante exportée depuis un fichier
 * `"use client"` devient une **référence opaque** quand un composant serveur
 * l'importe — elle ne vaut plus la chaîne qu'elle contient, et le cookie
 * n'est jamais retrouvé. Le défaut est silencieux : rien ne casse, le réglage
 * ne se souvient simplement de rien.
 *
 * Un cookie plutôt que le stockage local : c'est le serveur qui doit connaître
 * la préférence, puisque c'est lui qui rend la première image.
 */

/** Rail de navigation replié. `"1"` replié, tout le reste déplié. */
export const RAIL_COOKIE = "antidotes_rail";

/**
 * Montants de trésorerie masqués sur l'écran Finance. `"1"` masqué.
 *
 * Le défaut est « visible » : c'est un écran privé, et un chiffre caché par
 * défaut obligerait à un clic à chaque ouverture. Le masque sert au moment où
 * quelqu'un regarde par-dessus l'épaule, pas en permanence.
 */
export const CASH_HIDDEN_COOKIE = "antidotes_cash_hidden";

/** Un an, limité à ce site : une préférence d'affichage ne voyage pas. */
export const PREFERENCE_MAX_AGE = 31_536_000;

// --- Planning Éditorial : l'état de lecture d'un tableau ---------------------

/**
 * Un cookie par tableau : le tri de la colonne Date, les mois ouverts, les
 * réseaux repliés. On revient sur le planning tel qu'on l'a laissé.
 *
 * Un cookie par tableau plutôt qu'un seul pour tous : chacun reste petit, et
 * l'oubli d'un tableau ne touche pas les autres.
 */
export function planningViewCookie(workspace: string, board: string): string {
  return `antidotes_planning_${workspace}_${board}`.replace(/[^\w]/g, "_");
}

export type PlanningView = {
  /** `position` : l'ordre manuel du tableau. */
  sort: "position" | "asc" | "desc";
  /**
   * Mois ouverts, par clé `YYYY-MM`.
   *
   * `null` — jamais touché — vaut « le mois en cours, comme au premier jour » ;
   * une liste **vide** vaut « tout replié », et c'est un choix. Confondre les
   * deux rouvrirait le mois courant à chaque retour sur la page.
   */
  months: string[] | null;
  /**
   * Réseaux **repliés**, par identifiant. Un couloir est ouvert par défaut :
   * mémoriser l'exception plutôt que la règle garde le cookie court.
   */
  closedLanes: string[];
};

export const DEFAULT_PLANNING_VIEW: PlanningView = {
  sort: "position",
  months: null,
  closedLanes: [],
};

/**
 * Relit le cookie sans jamais jeter : un cookie tronqué, écrit par une version
 * précédente ou bricolé à la main, doit rendre le tableau par défaut — pas une
 * page en erreur.
 */
export function parsePlanningView(raw: string | undefined): PlanningView {
  if (!raw) return DEFAULT_PLANNING_VIEW;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_PLANNING_VIEW;

    const value = parsed as Partial<Record<keyof PlanningView, unknown>>;
    const strings = (input: unknown): string[] =>
      Array.isArray(input)
        ? input.filter((entry): entry is string => typeof entry === "string").slice(0, 200)
        : [];

    return {
      sort:
        value.sort === "asc" || value.sort === "desc" || value.sort === "position"
          ? value.sort
          : "position",
      months: Array.isArray(value.months) ? strings(value.months) : null,
      closedLanes: strings(value.closedLanes),
    };
  } catch {
    return DEFAULT_PLANNING_VIEW;
  }
}

export function serializePlanningView(view: PlanningView): string {
  return encodeURIComponent(JSON.stringify(view));
}
