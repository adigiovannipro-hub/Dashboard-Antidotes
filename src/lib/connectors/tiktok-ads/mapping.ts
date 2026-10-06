import type { TiktokAdvertiser, TiktokReportRow } from "./types";

/**
 * Traductions pures de la Marketing API de TikTok vers nos tables.
 *
 * Sans réseau, sans base : tout se rejoue sur les charges utiles réelles
 * relevées le 1/10/2026 (voir `mapping.test.ts`).
 */

/**
 * Les grandeurs demandées au rapport intégré, au grain groupe d'annonces × jour.
 *
 * Toutes **additives** — les ratios se recalculent à la lecture, comme pour
 * Meta. Les noms ont été acceptés tels quels par l'API sur le compte d'ANMF :
 * un nom inconnu fait échouer l'appel entier (code 40002), il ne rend pas une
 * colonne vide.
 *
 *   `clicks`                      les clics vers la destination ;
 *   `video_play_actions`          la vue au sens de TikTok (le lancement) ;
 *   `video_views_p100`            la lecture complète ;
 *   `total_landing_page_view`     les arrivées sur la page ;
 *   `complete_payment`            les achats suivis par le pixel ;
 *   `value_per_complete_payment`  la valeur moyenne d'un achat — la valeur
 *                                 totale s'en déduit, plutôt que de lire
 *                                 `total_complete_payment_rate`, dont le nom
 *                                 dit un taux.
 */
export const REPORT_METRICS = [
  "spend",
  "impressions",
  "reach",
  "clicks",
  "comments",
  "shares",
  "video_play_actions",
  "video_views_p100",
  "total_landing_page_view",
  "complete_payment",
  "value_per_complete_payment",
  "campaign_id",
  "campaign_name",
  "adgroup_name",
] as const;

/** Les grandeurs du rapport d'audience — de quoi peindre le Persona. */
export const AUDIENCE_METRICS = ["spend", "impressions", "clicks"] as const;

/**
 * La plus longue période qu'un rapport au grain jour accepte.
 *
 * Constaté sur pièce : au-delà, TikTok répond « max time span is 30 days when
 * use stat_time_day » (code 40002). Trente jours **bornes comprises**.
 */
export const MAX_DAYS_PER_REPORT = 30;

/** Le nombre de lignes demandées par page — la pagination fait le reste. */
export const PAGE_SIZE = 500;

function toNumber(value: unknown): number {
  // TikTok rend des chaînes, et « - » quand la mesure ne s'applique pas au
  // compte : c'est une absence, pas une erreur.
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/** Combien de pages il reste, lu dans `page_info`. */
export function totalPages(data: unknown): number {
  const info = asRecord(asRecord(data).page_info);
  const total = toNumber(info.total_page);
  return total > 0 ? total : 1;
}

/** Les lignes d'une page de réponse, quel que soit l'endpoint. */
export function listOf(data: unknown): unknown[] {
  return asList(asRecord(data).list);
}

/** Les Business Centers que le compte branché administre — `/bc/get/`. */
export function businessCentersFrom(data: unknown): { id: string; name: string | null }[] {
  return listOf(data).flatMap((entry) => {
    const info = asRecord(asRecord(entry).bc_info);
    const id = asText(info.bc_id);
    return id ? [{ id, name: asText(info.name) }] : [];
  });
}

/** Les comptes publicitaires d'un Business Center — `/bc/asset/get/`. */
export function advertisersFrom(
  data: unknown,
  businessCenter: { id: string; name: string | null },
): TiktokAdvertiser[] {
  return listOf(data).flatMap((entry) => {
    const asset = asRecord(entry);
    const id = asText(asset.asset_id);
    if (!id) return [];
    if (asset.asset_type && asset.asset_type !== "ADVERTISER") return [];
    return [
      {
        id,
        name: asText(asset.asset_name) ?? id,
        businessCenterId: businessCenter.id,
        businessCenterName: asText(asset.owner_bc_name) ?? businessCenter.name,
      },
    ];
  });
}

/**
 * Un même compte peut appartenir à deux Business Centers (l'agence et le
 * client) : il n'entre qu'une fois dans l'inventaire, sous le premier vu.
 */
export function uniqueAdvertisers(list: TiktokAdvertiser[]): TiktokAdvertiser[] {
  const seen = new Map<string, TiktokAdvertiser>();
  for (const advertiser of list) {
    if (!seen.has(advertiser.id)) seen.set(advertiser.id, advertiser);
  }
  return [...seen.values()];
}

/**
 * Découpe une période en tranches de trente jours au plus, bornes comprises
 * des deux côtés : la fin d'une tranche et le début de la suivante se
 * touchent sans se recouvrir, sinon un jour tomberait entre deux et le trou
 * ne se verrait que sur la courbe, des semaines plus tard.
 */
export function reportWindows(
  since: string,
  until: string,
  maxDays: number = MAX_DAYS_PER_REPORT,
): { from: string; to: string }[] {
  const day = 86_400_000;
  const start = Date.parse(`${since}T00:00:00Z`);
  const end = Date.parse(`${until}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return [];

  const windows: { from: string; to: string }[] = [];
  for (let from = start; from <= end; from += maxDays * day) {
    const to = Math.min(from + (maxDays - 1) * day, end);
    windows.push({
      from: new Date(from).toISOString().slice(0, 10),
      to: new Date(to).toISOString().slice(0, 10),
    });
  }
  return windows;
}

/** Une journée d'un groupe d'annonces, en grandeurs additives. */
export type TiktokDailyAdGroup = {
  adgroupId: string;
  adgroupName: string;
  campaignId: string | null;
  campaignName: string | null;
  date: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  comments: number;
  shares: number;
  videoViews: number;
  videoCompletions: number;
  landingPageViews: number;
  purchases: number;
  purchaseValue: number;
};

/**
 * Les lignes du rapport intégré, traduites.
 *
 * TikTok rend une ligne par groupe d'annonces **et par jour de la période**,
 * même quand rien n'a tourné : sur septembre 2026, 57 lignes dont la moitié à
 * zéro partout. Celles-là sont écartées — un groupe éteint ne doit pas
 * peupler le tableau du Reporting de lignes vides.
 */
export function dailyAdGroups(rows: TiktokReportRow[]): TiktokDailyAdGroup[] {
  return rows.flatMap((row) => {
    const dimensions = row.dimensions ?? {};
    const metrics = row.metrics ?? {};
    const adgroupId = asText(dimensions.adgroup_id);
    const date = asText(dimensions.stat_time_day)?.slice(0, 10) ?? null;
    if (!adgroupId || !date) return [];

    const purchases = toNumber(metrics.complete_payment);
    const parsed: TiktokDailyAdGroup = {
      adgroupId,
      adgroupName: asText(metrics.adgroup_name) ?? adgroupId,
      campaignId: asText(metrics.campaign_id),
      campaignName: asText(metrics.campaign_name),
      date,
      spend: toNumber(metrics.spend),
      impressions: toNumber(metrics.impressions),
      reach: toNumber(metrics.reach),
      clicks: toNumber(metrics.clicks),
      comments: toNumber(metrics.comments),
      shares: toNumber(metrics.shares),
      videoViews: toNumber(metrics.video_play_actions),
      videoCompletions: toNumber(metrics.video_views_p100),
      landingPageViews: toNumber(metrics.total_landing_page_view),
      purchases,
      purchaseValue:
        Math.round(purchases * toNumber(metrics.value_per_complete_payment) * 100) / 100,
    };

    const silent =
      parsed.spend === 0 &&
      parsed.impressions === 0 &&
      parsed.clicks === 0 &&
      parsed.videoViews === 0 &&
      parsed.purchases === 0;
    return silent ? [] : [parsed];
  });
}

/**
 * Une journée vers les colonnes de `ad_metrics_daily`.
 *
 * Les clics de TikTok sont des clics **vers la destination** : ils vont dans
 * `clicks` comme dans `link_clicks`, sans quoi le CPC du Reporting, calculé
 * sur les clics de lien, resterait vide. La portée est sommée jour par jour —
 * l'approximation additive que fait déjà Meta (migration 0045).
 */
export function toDailyMetricsColumns(row: TiktokDailyAdGroup) {
  return {
    date: row.date,
    spend: row.spend,
    impressions: row.impressions,
    reach: row.reach,
    clicks: row.clicks,
    link_clicks: row.clicks,
    purchases: row.purchases,
    purchase_value: row.purchaseValue,
    landing_page_views: row.landingPageViews,
    add_to_cart: 0,
    initiated_checkout: 0,
    comments: row.comments,
    saves: 0,
    shares: row.shares,
    video_views: row.videoViews,
    video_completions: row.videoCompletions,
  };
}

/** Les campagnes et groupes d'annonces vus dans un rapport, une fois chacun. */
export function entitiesFrom(rows: TiktokDailyAdGroup[]): {
  level: "campaign" | "adset";
  externalId: string;
  parentExternalId: string | null;
  name: string;
}[] {
  const entities = new Map<
    string,
    { level: "campaign" | "adset"; externalId: string; parentExternalId: string | null; name: string }
  >();
  for (const row of rows) {
    if (row.campaignId && !entities.has(row.campaignId)) {
      entities.set(row.campaignId, {
        level: "campaign",
        externalId: row.campaignId,
        parentExternalId: null,
        name: row.campaignName ?? row.campaignId,
      });
    }
    // Un groupe d'annonces de TikTok est l'ad set de Meta : même rang, même
    // tableau dans le Reporting.
    entities.set(row.adgroupId, {
      level: "adset",
      externalId: row.adgroupId,
      parentExternalId: row.campaignId,
      name: row.adgroupName,
    });
  }
  return [...entities.values()];
}

/** « AGE_18_24 » → « 18-24 », dans la forme que Meta range déjà. */
export function ageLabel(raw: unknown): string {
  const value = typeof raw === "string" ? raw : "";
  const match = /^AGE_(\d+)_(\d+)$/.exec(value);
  if (!match) return "Inconnu";
  // TikTok borne la dernière tranche à 100 : « 55+ » se lit, « 55-100 » non.
  return Number(match[2]) >= 100 ? `${match[1]}+` : `${match[1]}-${match[2]}`;
}

/** « FEMALE » → « Femmes », comme le libellé de Meta. */
export function genderLabel(raw: unknown): string {
  if (raw === "FEMALE") return "Femmes";
  if (raw === "MALE") return "Hommes";
  return "Inconnu";
}

/**
 * Le rapport d'audience vers `ad_breakdowns_daily`, sommé par jour et par
 * libellé — deux valeurs brutes peuvent tomber sur le même libellé
 * (« NONE » et une tranche inconnue font toutes deux « Inconnu »), et la clé
 * primaire n'en accepte qu'une.
 */
export function audienceBreakdown(
  rows: TiktokReportRow[],
  axis: "age" | "gender",
): { date: string; value: string; spend: number; impressions: number; clicks: number }[] {
  const cells = new Map<
    string,
    { date: string; value: string; spend: number; impressions: number; clicks: number }
  >();
  for (const row of rows) {
    const dimensions = row.dimensions ?? {};
    const metrics = row.metrics ?? {};
    const date = asText(dimensions.stat_time_day)?.slice(0, 10) ?? null;
    if (!date) continue;

    const value = axis === "age" ? ageLabel(dimensions.age) : genderLabel(dimensions.gender);
    const key = `${date}|${value}`;
    const cell = cells.get(key) ?? { date, value, spend: 0, impressions: 0, clicks: 0 };
    cell.spend += toNumber(metrics.spend);
    cell.impressions += toNumber(metrics.impressions);
    cell.clicks += toNumber(metrics.clicks);
    cells.set(key, cell);
  }
  return [...cells.values()].filter((cell) => cell.impressions > 0 || cell.spend > 0);
}
