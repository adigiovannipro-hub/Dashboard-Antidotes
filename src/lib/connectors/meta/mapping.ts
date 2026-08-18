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
  /** Présents sur les requêtes `level=adset`. */
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
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

/**
 * Une ligne d'Insights vers les colonnes de `ad_metrics_daily`.
 *
 * Colonnes en snake_case : c'est la ligne d'insertion, pas le modèle de
 * lecture. Les identifiants (source, espace, entité) sont posés par
 * l'orchestrateur — cette fonction ne connaît que la traduction.
 */
export function toDailyMetricsColumns(row: MetaInsightRow): {
  date: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  link_clicks: number;
  purchases: number;
  purchase_value: number;
  landing_page_views: number;
  add_to_cart: number;
  initiated_checkout: number;
  comments: number;
  saves: number;
  shares: number;
} {
  const raw = toRawMetrics(row);
  return {
    date: row.date_start ?? "",
    spend: raw.spend,
    impressions: raw.impressions,
    reach: raw.reach,
    clicks: raw.clicks,
    link_clicks: raw.linkClicks,
    purchases: raw.purchases,
    purchase_value: raw.purchaseValue,
    landing_page_views: raw.landingPageViews,
    add_to_cart: raw.addToCart,
    initiated_checkout: raw.initiatedCheckout,
    comments: raw.comments,
    saves: raw.saves,
    shares: raw.shares,
  };
}

/**
 * Agrège des lignes ventilées vers un seul axe.
 *
 * L'appel `breakdowns=age,gender` rend des cellules âge × genre : plutôt que
 * de payer deux appels par compte et par jour, on somme les cellules par âge
 * d'un côté, par genre de l'autre. La clé composite jour + valeur suit la clé
 * primaire de `ad_breakdowns_daily`.
 */
export function aggregateBreakdown(
  rows: MetaInsightRow[],
  axis: "age" | "gender" | "region",
): { date: string; value: string; spend: number; impressions: number; clicks: number }[] {
  const cells = new Map<
    string,
    { date: string; value: string; spend: number; impressions: number; clicks: number }
  >();

  for (const row of rows) {
    const date = row.date_start ?? "";
    if (!date) continue;
    const value = breakdownLabel(row[axis]);
    const key = `${date}|${value}`;
    const cell = cells.get(key) ?? { date, value, spend: 0, impressions: 0, clicks: 0 };
    cell.spend += toNumber(row.spend);
    cell.impressions += toNumber(row.impressions);
    cell.clicks += toNumber(row.clicks);
    cells.set(key, cell);
  }

  return [...cells.values()];
}

/**
 * Combien de mois le tout premier passage remonte.
 *
 * Une année : c'est le rattrapage qu'on ne peut pas rejouer plus tard sans
 * frais — Meta finit par ne plus servir les statistiques des vieilles
 * publications, et un reporting qui démarre à trois mois d'historique ne sait
 * comparer aucun mois à l'année précédente.
 */
export const BACKFILL_MONTHS = 12;

/**
 * La fenêtre de synchronisation, en dates UTC.
 *
 * **Premier passage : douze mois**, une fois et une seule — c'est le sens de
 * `data_sources.backfill_from`, qui garde la date atteinte. Ensuite : 35
 * jours glissants, parce que Meta **réécrit** les conversions jusqu'à 28
 * jours en arrière (fenêtres d'attribution) — ne resynchroniser que la veille
 * figerait des chiffres encore mouvants, et re-balayer l'année à chaque
 * passage coûterait des milliers d'appels pour redire la même chose.
 *
 * La borne haute est aujourd'hui : la journée en cours est partielle, mais le
 * passage suivant la réécrit, et l'interface borne de toute façon à hier.
 */
export function syncWindow(options: {
  lastSyncAt: string | null;
  now: Date;
  /** Étend la fenêtre en arrière — la plage que l'écran demande à voir. */
  atLeastSince?: string;
}): { since: string; until: string } {
  const day = (offset: number) => {
    const at = new Date(options.now.getTime() + offset * 86_400_000);
    return at.toISOString().slice(0, 10);
  };

  const first = new Date(
    Date.UTC(
      options.now.getUTCFullYear(),
      options.now.getUTCMonth() - BACKFILL_MONTHS,
      1,
    ),
  )
    .toISOString()
    .slice(0, 10);

  const computed = options.lastSyncAt ? day(-35) : first;
  const since =
    options.atLeastSince && options.atLeastSince < computed
      ? options.atLeastSince
      : computed;
  return { since, until: day(0) };
}

/**
 * Le préfixe sous lequel Meta rend un événement pixel **personnalisé**.
 *
 * Ce qui suit est le nom que le client a donné à son événement, tel quel,
 * espaces compris : `offsite_conversion.fb_pixel_custom.Validation Shop Lyon`.
 * On ne peut donc pas le reconnaître par une liste — il n'appartient pas au
 * produit — seulement par ce préfixe.
 */
const CUSTOM_EVENT_PREFIX = "offsite_conversion.fb_pixel_custom.";

export type CustomEvent = { name: string; count: number; value: number };

/**
 * Les événements personnalisés d'une ligne d'Insights, avec leur nom.
 *
 * Ils vivent à part des métriques standards, et c'est délibéré : « Validation
 * Shop Lyon » n'est pas un achat. Les verser dans `purchases` fabriquerait un
 * ROAS à partir d'un événement qui ne porte aucun montant, et le tableau de
 * bord annoncerait un chiffre d'affaires que personne n'a encaissé.
 *
 * Le nom est pris **après le préfixe** et non au dernier point : un client
 * peut nommer son événement « Résa 2.0 », et couper au dernier point rendrait
 * « 0 ».
 */
export function customEvents(row: MetaInsightRow): CustomEvent[] {
  const byName = new Map<string, CustomEvent>();

  const collect = (
    entries: { action_type: string; value: string }[] | undefined,
    field: "count" | "value",
  ) => {
    for (const entry of entries ?? []) {
      if (!entry.action_type.startsWith(CUSTOM_EVENT_PREFIX)) continue;

      const name = entry.action_type.slice(CUSTOM_EVENT_PREFIX.length).trim();
      if (name.length === 0) continue;

      const current = byName.get(name) ?? { name, count: 0, value: 0 };
      current[field] += toNumber(entry.value);
      byName.set(name, current);
    }
  };

  collect(row.actions, "count");
  collect(row.action_values, "value");

  return [...byName.values()];
}
