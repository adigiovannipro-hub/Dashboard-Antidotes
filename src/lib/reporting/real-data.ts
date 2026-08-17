import type { BarDatum } from "@/components/viz/bar-list";
import type { MetricsTableRow } from "@/components/viz/metrics-table";
import { sumRawMetrics } from "@/lib/metrics/aggregate";
import { EMPTY_RAW_METRICS, type RawMetrics } from "@/lib/metrics/types";
import type {
  AdBreakdownDaily,
  AdEntity,
  AdMetricsDaily,
  SocialFollowers,
  SocialPost,
} from "@/lib/supabase/database.types";

/**
 * Des lignes de base vers les props des dashboards.
 *
 * Fonctions pures, zéro import Supabase : c'est ici que se joue la justesse
 * de l'agrégation — sommes par entité, parts d'une ventilation, série
 * d'abonnés — et c'est donc ici qu'on teste. Les requêtes de
 * `queries.ts` ne font que charger les lignes.
 */

/** Une ligne journalière vers le modèle canonique. */
export function metricsRowToRaw(row: AdMetricsDaily): RawMetrics {
  return {
    spend: Number(row.spend),
    impressions: Number(row.impressions),
    reach: Number(row.reach),
    clicks: Number(row.clicks),
    linkClicks: Number(row.link_clicks),
    purchases: Number(row.purchases),
    purchaseValue: Number(row.purchase_value),
    landingPageViews: Number(row.landing_page_views),
    addToCart: Number(row.add_to_cart),
    initiatedCheckout: Number(row.initiated_checkout),
    comments: Number(row.comments),
    saves: Number(row.saves),
    shares: Number(row.shares),
    // Grandeurs organiques : la table publicitaire ne les porte pas.
    likes: 0,
    videoViews: 0,
  };
}

/**
 * Le tableau par ad set : une ligne par entité `adset`, sommée sur la période.
 *
 * Le nom de campagne se retrouve par le parent : les lignes journalières ne
 * portent que l'entité, et c'est l'inventaire `ad_entities` qui connaît la
 * filiation.
 */
export function buildAdSetRows(
  entities: AdEntity[],
  metrics: AdMetricsDaily[],
): MetricsTableRow[] {
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const byExternal = new Map(entities.map((entity) => [entity.external_id, entity]));

  const rawByEntity = new Map<string, RawMetrics[]>();
  for (const row of metrics) {
    const list = rawByEntity.get(row.entity_id) ?? [];
    list.push(metricsRowToRaw(row));
    rawByEntity.set(row.entity_id, list);
  }

  const rows: MetricsTableRow[] = [];
  for (const [entityId, raws] of rawByEntity) {
    const entity = byId.get(entityId);
    if (!entity || entity.level !== "adset") continue;

    const campaign = entity.parent_external_id
      ? byExternal.get(entity.parent_external_id)?.name
      : undefined;

    rows.push({
      id: entity.external_id,
      campaign: campaign ?? "—",
      adSet: entity.name,
      raw: sumRawMetrics(raws),
    });
  }

  return rows.sort((a, b) => b.raw.spend - a.raw.spend);
}

/**
 * Une ventilation sommée sur la période, en parts.
 *
 * La part se calcule sur le total **de la ventilation**, pas sur celui du
 * compte : les deux divergent légèrement chez Meta, et des parts qui ne
 * sommeraient pas à 100 % se liraient comme un bug.
 */
export function buildBreakdown(
  rows: AdBreakdownDaily[],
  type: AdBreakdownDaily["type"],
): BarDatum[] {
  const byValue = new Map<string, number>();
  for (const row of rows) {
    if (row.type !== type) continue;
    byValue.set(row.value, (byValue.get(row.value) ?? 0) + Number(row.impressions));
  }

  const total = [...byValue.values()].reduce((sum, value) => sum + value, 0);
  if (total === 0) return [];

  const entries = [...byValue.entries()].map(([label, value]) => ({
    label,
    value,
    share: value / total,
    outOfScale: label === "Inconnu",
  }));

  // Les tranches d'âge se lisent dans l'ordre des âges ; les autres axes, du
  // plus gros au plus petit. « Inconnu » ferme toujours la marche.
  const rank = (entry: BarDatum) => (entry.label === "Inconnu" ? 1 : 0);
  return type === "age"
    ? entries.sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label, "fr"))
    : entries.sort((a, b) => rank(a) - rank(b) || b.value - a.value);
}

const SHORT_MONTHS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

/**
 * La courbe d'abonnés : un point par mois, **figé au relevé du 1ᵉʳ**.
 *
 * Le passage quotidien de 5h pose un relevé chaque jour : le 1ᵉʳ du mois est
 * donc toujours couvert, automatiquement. C'est lui qui fait foi — et non le
 * dernier relevé du mois, qui bougeait à chaque synchronisation manuelle :
 * cliquer « Synchroniser » un 17 réécrivait le point du mois en cours sur
 * tous les réseaux, et une courbe qui change selon l'heure du clic n'est pas
 * une mesure. Si le 1ᵉʳ manque — premier mois d'usage — le plus ancien relevé
 * du mois tient lieu de 1ᵉʳ, puis ne bouge plus.
 *
 * La courbe lit cette table, jamais l'API : la base est le registre.
 */
export function monthlyFollowersSeries(
  rows: SocialFollowers[],
): { label: string; value: number }[] {
  const byMonth = new Map<string, { date: string; value: number }>();
  for (const row of rows) {
    const month = row.date.slice(0, 7);
    const current = byMonth.get(month);
    if (!current || row.date < current.date) {
      byMonth.set(month, { date: row.date, value: row.followers_count });
    }
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, entry]) => {
      const [year, index] = month.split("-").map(Number);
      return {
        label: `${SHORT_MONTHS[(index ?? 1) - 1]} ${year}`,
        value: entry.value,
      };
    });
}

/**
 * Le total organique d'une période : la somme des publications qui y sont
 * parues. C'est la définition des rapports organiques historiques — un post
 * de juillet compte dans juillet, même si on le regarde en août.
 */
export function sumPosts(posts: SocialPost[]): RawMetrics {
  return posts.reduce<RawMetrics>(
    (total, post) => ({
      ...total,
      impressions: total.impressions + Number(post.impressions),
      reach: total.reach + Number(post.reach),
      comments: total.comments + Number(post.comments),
      saves: total.saves + Number(post.saves),
      shares: total.shares + Number(post.shares),
      likes: total.likes + Number(post.likes),
      // Mesurées à la collecte : Facebook compte les lectures à part des
      // impressions, les déduire du type de média donnerait un faux.
      videoViews: total.videoViews + Number(post.video_views ?? 0),
    }),
    { ...EMPTY_RAW_METRICS },
  );
}
