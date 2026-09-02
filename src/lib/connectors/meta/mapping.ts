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
  /** Lectures jusqu'au bout — même forme que `actions`, un seul type `video_view`. */
  video_p100_watched_actions?: { action_type: string; value: string }[];
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

  /* La variante se choisit dans l'ordre de SOURCE_PREFIXES, jamais dans
     l'ordre du tableau que Meta rend — cet ordre n'est pas garanti, et un
     `find` dessus faisait gagner tantôt `omni_purchase`, tantôt
     `offsite_conversion.fb_pixel_purchase` selon le jour. `omni_*` d'abord :
     c'est le sur-ensemble multi-canal, les autres n'en sont que des vues. */
  const tailOf = (actionType: string) => actionType.split(".").pop() ?? "";
  const bare = actions.find((action) => tailOf(action.action_type) === type);
  if (bare) return toNumber(bare.value);
  for (const prefix of SOURCE_PREFIXES) {
    const variant = actions.find(
      (action) => tailOf(action.action_type) === `${prefix}${type}`,
    );
    if (variant) return toNumber(variant.value);
  }
  return 0;
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
    /* `video_view` dans `actions` est la vue au sens de Meta : trois secondes
       de lecture. La lecture complète arrive dans un tableau à part, de même
       forme, sous le même `action_type` — c'est le champ qui porte le sens. */
    videoViews: actionValue(row.actions, "video_view"),
    videoCompletions: actionValue(row.video_p100_watched_actions, "video_view"),
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
  video_views: number;
  video_completions: number;
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
    video_views: raw.videoViews,
    video_completions: raw.videoCompletions,
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
/**
 * Les préfixes sous lesquels Meta range un événement que le client a nommé
 * lui-même. Deux formes coexistent, et le compte d'I-WAY a montré qu'on ne
 * peut pas parier sur l'une :
 *
 *   • `offsite_conversion.fb_pixel_custom.<Nom>` — un `trackCustom` du pixel ;
 *   • `offsite_conversion.custom.<id>` — une conversion personnalisée, qui ne
 *     porte que son identifiant numérique.
 */
const CUSTOM_EVENT_PREFIXES = [
  "offsite_conversion.fb_pixel_custom.",
  "offsite_conversion.custom.",
];

/**
 * Les types d'action que le modèle canonique consomme déjà, plus le bruit de
 * l'API — vues de vidéo, réactions, clics sortants. Tout ce qui n'est pas là
 * dedans est, par définition, un événement propre au client.
 *
 * La liste est **écrite en toutes lettres** plutôt que devinée : c'est elle
 * qui décide de ce qui apparaît à l'écran, et une devinette y ferait entrer
 * des doublons de métriques déjà affichées ailleurs.
 */
/**
 * L'agrégat sous lequel Meta rend les événements `trackCustom` **sans leurs
 * noms** dans les Insights. Relevé en production sur I-WAY : le Gestionnaire
 * affiche bien « Validation Shop Lyon » colonne par colonne, mais l'API ne
 * rend que ce total — 11 conversions, 466,30 € de valeur sur juin, le même
 * champ que le « Website custom conversions » du Looker.
 */
export const PIXEL_CUSTOM_AGGREGATE = "offsite_conversion.fb_pixel_custom";

/**
 * Le bruit d'engagement que « garder tout ce qui n'est pas standard » a
 * laissé passer au premier vrai sync : huit cartes de likes et de
 * sauvegardes, toutes redites de métriques déjà affichées ailleurs. Relevé
 * en production, exclu nommément — et purgé de la base par 0055.
 */
/* Uniquement ce qui a été **vu** : `onsite_conversion.messaging_*` n'y entre
   pas — `messaging_conversation_started_7d` est LA conversion d'une campagne
   click-to-Messenger, l'exclure d'avance referait le silence qu'on répare. */
const TYPES_BRUIT = new Set(["post_interaction_net", "post_interaction_gross"]);
const PREFIXES_BRUIT = ["onsite_conversion.post_"];

const TYPES_STANDARDS = new Set([
  "purchase",
  "landing_page_view",
  "add_to_cart",
  "initiate_checkout",
  "comment",
  "post",
  "post_reaction",
  "post_engagement",
  "page_engagement",
  "like",
  "link_click",
  "onsite_conversion.post_save",
  "lead",
  "complete_registration",
  "view_content",
  "search",
  "video_view",
  "outbound_click",
  "landing_page_view_from_ad",
]);

/**
 * Le nom lisible d'un type d'action, ou `null` si c'est une métrique standard.
 *
 * **Aucun filtre sur un préfixe unique.** C'est ce filtre qui a fait qu'I-WAY
 * n'a jamais rien remonté : ses quatre événements — « Validation Shop Lyon »,
 * « Validation Shop Paris », « Validation Resa Lyon », « Validation Resa
 * Paris » — existent bel et bien dans le pixel (relevés au compteur du
 * dataset), mais rien ne garantissait qu'ils arrivent sous le préfixe attendu.
 * On garde donc **tout ce qui n'est pas standard**, sous le nom que Meta rend.
 * Au pire un type inconnu s'affiche sous sa forme brute, ce qui se voit et se
 * corrige ; au mieux il porte déjà son nom. Le silence, lui, ne se corrige
 * pas : il ressemble à « ce client n'a aucune conversion ».
 */
export function customEventName(actionType: string): string | null {
  const type = actionType.trim();
  if (type.length === 0) return null;

  for (const prefixe of CUSTOM_EVENT_PREFIXES) {
    if (type.startsWith(prefixe)) {
      // Coupé **après le préfixe** et non au dernier point : « Résa 2.0 »
      // deviendrait « 0 ».
      const nom = type.slice(prefixe.length).trim();
      return nom.length > 0 ? nom : null;
    }
  }

  if (TYPES_BRUIT.has(type) || PREFIXES_BRUIT.some((p) => type.startsWith(p))) {
    return null;
  }

  // Les variantes de source d'un événement standard — `omni_purchase`,
  // `offsite_conversion.fb_pixel_purchase` — sont déjà comptées par
  // `actionValue`. Les laisser passer ferait apparaître l'achat deux fois.
  const feuille = type.includes(".") ? type.slice(type.lastIndexOf(".") + 1) : type;
  if (TYPES_STANDARDS.has(type) || TYPES_STANDARDS.has(feuille)) return null;
  for (const prefixe of SOURCE_PREFIXES) {
    if (feuille.startsWith(prefixe) && TYPES_STANDARDS.has(feuille.slice(prefixe.length))) {
      return null;
    }
  }

  return type;
}

export type CustomEvent = { name: string; count: number; value: number };

/**
 * Les événements personnalisés d'une ligne d'Insights, avec leur nom.
 *
 * Ils vivent à part des métriques standards par défaut : « Validation Shop
 * Lyon » n'est pas un achat pour tout le monde. Chez I-WAY, si — c'est le
 * réglage `purchase_event_names` / `add_to_cart_event_names` du compte qui
 * tranche, et il s'applique **à la lecture**.
 */
export function customEvents(row: MetaInsightRow): CustomEvent[] {
  const byName = new Map<string, CustomEvent>();
  let nommes = false;

  const collect = (
    entries: { action_type: string; value: string }[] | undefined,
    field: "count" | "value",
  ) => {
    for (const entry of entries ?? []) {
      const name = customEventName(entry.action_type);
      if (name === null) continue;
      if (entry.action_type.trim().startsWith(`${PIXEL_CUSTOM_AGGREGATE}.`)) {
        nommes = true;
      }

      const current = byName.get(name) ?? { name, count: 0, value: 0 };
      current[field] += toNumber(entry.value);
      byName.set(name, current);
    }
  };

  collect(row.actions, "count");
  collect(row.action_values, "value");

  /* L'agrégat est la somme des événements nommés : quand Meta rend les deux
     formes, ne garder que le détail — les compter ensemble doublerait tout.
     Quand seul l'agrégat arrive — le cas d'I-WAY aujourd'hui — il reste. */
  if (nommes) byName.delete(PIXEL_CUSTOM_AGGREGATE);

  return [...byName.values()];
}
