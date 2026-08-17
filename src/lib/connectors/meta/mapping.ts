import { EMPTY_RAW_METRICS, type RawMetrics } from "@/lib/metrics/types";

/**
 * Traduction des réponses Meta Insights vers le modèle canonique.
 *
 * Pure et testée à part : c'est ici que se joue la justesse du Reporting, et
 * c'est la seule couche du connecteur qu'on peut vérifier sans appeler Meta.
 *
 * Deux pièges de l'API valent d'être écrits une fois pour toutes :
 *
 *   • **les conversions arrivent en tableau**, pas en colonnes. `actions` liste
 *     `{ action_type, value }` pour tout ce qui a bougé, et un type absent
 *     signifie zéro, pas « inconnu » ;
 *   • **tout est en chaînes de caractères.** `"557255"`, `"2572.22"`. Sommer
 *     sans convertir concatène.
 */

/** Une ligne d'Insights telle que Graph la rend. */
export type MetaInsightRow = {
  date_start?: string;
  date_stop?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  inline_link_clicks?: string;
  frequency?: string;
  actions?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
  /** Présents seulement sur les requêtes ventilées. */
  age?: string;
  gender?: string;
  region?: string;
};

/** `"2572.22"` → 2572.22, et tout ce qui n'est pas un nombre → 0. */
export function toNumber(value: string | undefined): number {
  if (value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * La valeur d'une action, ou 0.
 *
 * Meta décline le même événement sous plusieurs noms selon sa source :
 * `purchase`, `omni_purchase`, `offsite_conversion.fb_pixel_purchase`. Le
 * type exact est donc cherché **d'abord**, et seulement à défaut une variante
 * qui s'en termine — dans cet ordre, sans quoi un compte qui expose les deux
 * verrait la variante l'emporter et compterait deux fois selon le jour.
 *
 * Sans cette tolérance, les achats d'un compte à pixel tombaient à zéro sans
 * que rien ne le signale.
 */
/**
 * Les préfixes que Meta colle devant un même événement selon sa provenance.
 *
 * Liste explicite et non un `endsWith("_" + type)` : ce dernier faisait passer
 * `initiate_checkout` pour un `checkout`, or ce sont deux événements
 * différents. Un préfixe inconnu vaut mieux qu'un faux rapprochement — il rend
 * zéro, ce qui se voit, là où l'amalgame invente un chiffre.
 */
const SOURCE_PREFIXES = ["omni_", "fb_pixel_", "web_in_store_", "offsite_"];

export function actionValue(
  actions: { action_type: string; value: string }[] | undefined,
  type: string,
): number {
  if (!actions) return 0;

  const exact = actions.find((action) => action.action_type === type);
  if (exact) return toNumber(exact.value);

  const variant = actions.find((action) => {
    // Le préfixe de source se coupe au dernier point : de
    // `offsite_conversion.fb_pixel_purchase` il reste `fb_pixel_purchase`.
    const tail = action.action_type.split(".").pop() ?? "";
    return tail === type || SOURCE_PREFIXES.some((p) => tail === `${p}${type}`);
  });
  return toNumber(variant?.value);
}

/** Une ligne d'Insights vers le modèle canonique. */
export function toRawMetrics(row: MetaInsightRow): RawMetrics {
  return {
    ...EMPTY_RAW_METRICS,
    spend: toNumber(row.spend),
    impressions: toNumber(row.impressions),
    reach: toNumber(row.reach),
    clicks: toNumber(row.clicks),
    linkClicks: toNumber(row.inline_link_clicks),
    purchases: actionValue(row.actions, "purchase"),
    purchaseValue: actionValue(row.action_values, "purchase"),
    landingPageViews: actionValue(row.actions, "landing_page_view"),
    addToCart: actionValue(row.actions, "add_to_cart"),
    initiatedCheckout: actionValue(row.actions, "initiate_checkout"),
    comments: actionValue(row.actions, "comment"),
    saves: actionValue(row.actions, "onsite_conversion.post_save"),
    shares: actionValue(row.actions, "post"),
  };
}

/**
 * Le libellé d'une ventilation, tel qu'il s'affiche.
 *
 * Meta rend `"unknown"` pour ce qu'il ne sait pas attribuer. On le traduit —
 * la capture Looker l'affiche « Inconnu » — au lieu de le masquer : une part
 * non attribuée reste une part, et la cacher fausserait les pourcentages.
 */
export function breakdownLabel(value: string | undefined): string {
  if (!value || value === "unknown") return "Inconnu";
  if (value === "male") return "Hommes";
  if (value === "female") return "Femmes";
  return value;
}
