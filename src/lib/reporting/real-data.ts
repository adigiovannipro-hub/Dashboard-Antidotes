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
    videoViews: Number(row.video_views ?? 0),
    videoCompletions: Number(row.video_completions ?? 0),
    // Grandeur organique : la table publicitaire ne la porte pas.
    likes: 0,
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
  /* Les événements désignés comme achats, par ad set. La colonne « Achats »
     du tableau doit dire la même chose que la carte du haut, sinon on lit
     deux totaux différents sur le même écran. */
  clientEvents: ReadonlyMap<string, CustomEventTotal[]> = new Map(),
  roles: ConversionRoles = NO_CONVERSION_ROLES,
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

    const events = clientEvents.get(entityId) ?? [];

    const campaign = entity.parent_external_id
      ? byExternal.get(entity.parent_external_id)?.name
      : undefined;

    rows.push({
      id: entity.external_id,
      campaign: campaign ?? "—",
      adSet: entity.name,
      raw: foldClientConversions(sumRawMetrics(raws), events, roles),
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

/** Profondeur de la courbe d'abonnés : un an, comme les rapports Looker. */
const FOLLOWERS_MONTHS_SHOWN = 12;

/**
 * La courbe d'abonnés : un point par mois, **le relevé de fin de mois**.
 *
 * C'est la convention des rapports historiques (Looker relevait au 31), et
 * celle des relevés repris de ces rapports : « juillet » veut dire « où on
 * en était au 31 juillet ». Le passage quotidien de 5h pose un relevé chaque
 * jour, **daté de la veille** — ce qu'il lit à 5h est le compte au sortir du
 * jour précédent (`closingDate`, connecteur Meta ; migration 0067 pour
 * l'existant). Le relevé du 1er septembre est donc le point du 31 août, et
 * août porte son propre chiffre. Daté du jour du passage, il tombait sous
 * septembre et chaque courbe avait un mois d'avance. Un mois révolu ne bouge
 * plus ; seul le mois en cours avance avec les passages.
 *
 * Les mois plus vieux que la fenêtre sont coupés : l'historique reste entier
 * en base, la courbe n'en montre que les douze derniers.
 *
 * La courbe lit cette table, jamais l'API : la base est le registre.
 */
export function monthlyFollowersSeries(
  rows: SocialFollowers[],
  now: Date = new Date(),
): { label: string; value: number }[] {
  /* Le mois en cours n'a pas encore de point de clôture : l'afficher
     donnerait « septembre » dès le 2 septembre, avec le relevé d'une nuit
     présenté comme un mois. Le reporting est mensuel et regarde le mois
     révolu ; la courbe s'arrête donc au dernier mois **fermé**, et le
     chiffre du jour vit dans la phrase du héros, pas sur la courbe. */
  const currentMonth = now.toISOString().slice(0, 7);
  const byMonth = new Map<string, { date: string; value: number }>();
  for (const row of rows) {
    const month = row.date.slice(0, 7);
    if (month >= currentMonth) continue;
    const current = byMonth.get(month);
    if (!current || row.date > current.date) {
      byMonth.set(month, { date: row.date, value: row.followers_count });
    }
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-FOLLOWERS_MONTHS_SHOWN)
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
      /* Les clics : LinkedIn les rend par publication, Meta jamais — la
         colonne reste donc à zéro ailleurs, sans fausser la somme. Le CTR
         se calcule sur les clics de lien, que LinkedIn ne distingue pas. */
      clicks: total.clicks + Number(post.clicks ?? 0),
      linkClicks: total.linkClicks + Number(post.clicks ?? 0),
    }),
    { ...EMPTY_RAW_METRICS },
  );
}

/**
 * Ce qu'un événement personnalisé a produit sur la période.
 *
 * Le coût par événement est **recalculé** depuis la dépense de la période et
 * le compte : c'est la règle du repo — seules les grandeurs additives sont
 * stockées, tout ratio se refait. Une moyenne de coûts journaliers serait
 * fausse, et c'est le piège classique.
 */
export type CustomEventTotal = {
  name: string;
  count: number;
  /** Somme des montants, `null` quand l'événement n'en porte aucun. */
  value: number | null;
  /** Dépense de la période ÷ nombre d'événements. `null` sans événement. */
  costPer: number | null;
};

/**
 * Les événements personnalisés d'une période, regroupés par nom.
 *
 * Le tri est décroissant sur le nombre : ce qui s'est le plus produit se lit
 * en premier. À nombre égal, l'ordre alphabétique, pour que deux passages
 * rendent la même liste.
 */
export function aggregateCustomEvents(
  rows: readonly { event_name: string; count: number; value: number }[],
  spend: number,
): CustomEventTotal[] {
  const byName = new Map<string, { count: number; value: number }>();

  for (const row of rows) {
    const name = row.event_name.trim();
    if (name.length === 0) continue;
    const current = byName.get(name) ?? { count: 0, value: 0 };
    current.count += Number(row.count) || 0;
    current.value += Number(row.value) || 0;
    byName.set(name, current);
  }

  return [...byName.entries()]
    .map(([name, totals]) => ({
      name,
      count: totals.count,
      // Zéro veut dire « sans montant », pas « gratuit » : on rend `null`
      // plutôt qu'un « 0,00 € » qui se lirait comme un chiffre d'affaires nul.
      value: totals.value > 0 ? totals.value : null,
      costPer: totals.count > 0 ? spend / totals.count : null,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "fr"));
}

/**
 * Verse dans les achats les événements que le client a désignés comme tels.
 *
 * Le défaut reste « aucun » : un événement personnalisé n'est pas une vente,
 * et 0051 les tient à part pour cette raison. Mais la règle ne vaut pas
 * partout — chez I-WAY, « Validation Shop Lyon » **est** l'achat. C'est donc
 * un réglage par compte, appliqué **à la lecture** : les lignes collectées
 * restent fidèles à ce que Meta a répondu, et changer d'avis ne demande pas
 * de resynchroniser un an d'historique.
 *
 * Le rapprochement des noms ignore casse et accents : le réglage est saisi à
 * la main, « validation shop lyon » doit retrouver « Validation Shop Lyon ».
 *
 * **Le montant ne s'invente pas.** Un événement sans valeur monétaire ajoute
 * des achats sans ajouter de chiffre d'affaires : le CPA devient juste, le
 * ROAS reste à zéro. C'est la vérité de la mesure, pas une approximation à
 * corriger — inventer un panier moyen ferait apparaître un chiffre d'affaires
 * que personne n'a encaissé.
 */
export type ConversionRoles = {
  /** Les événements que ce compte compte comme des ventes. */
  purchase: readonly string[];
  /** Ceux qu'il compte comme des mises au panier. */
  addToCart: readonly string[];
};

export const NO_CONVERSION_ROLES: ConversionRoles = { purchase: [], addToCart: [] };

/**
 * Comparaison de noms insensible à la casse et aux accents : « Résa » =
 * « Resa ». Exportée pour que l'écriture (`setConversionRole`) et l'affichage
 * (le rôle coché sur la carte) rapprochent **exactement comme la lecture** :
 * trois comparaisons différentes du même nom finissent toujours par un écran
 * qui se contredit.
 */
export function foldEventName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

/** Le rôle d'un événement d'après les listes du compte — rapproché en plié. */
export function conversionRoleOf(
  name: string,
  roles: ConversionRoles,
): "achat" | "panier" | "aucun" {
  const folded = foldEventName(name);
  if (roles.purchase.some((entry) => foldEventName(entry) === folded)) return "achat";
  if (roles.addToCart.some((entry) => foldEventName(entry) === folded)) {
    return "panier";
  }
  return "aucun";
}

export function foldClientConversions(
  metrics: RawMetrics,
  events: readonly CustomEventTotal[],
  roles: ConversionRoles,
): RawMetrics {
  if (roles.purchase.length === 0 && roles.addToCart.length === 0) return metrics;

  /* Un événement n'a qu'un rôle, et l'achat gagne : si une variante de
     casse ou d'accent du même nom traînait dans les deux listes, le compter
     des deux côtés gonflerait tuiles, entonnoir et tableau à la fois. */
  const somme = (role: "achat" | "panier") =>
    events
      .filter((event) => conversionRoleOf(event.name, roles) === role)
      .reduce(
        (total, event) => ({
          count: total.count + event.count,
          // `value` reste `null` quand l'événement ne porte aucun montant :
          // on n'invente pas un panier moyen pour faire vivre le ROAS.
          value: total.value + (event.value ?? 0),
        }),
        { count: 0, value: 0 },
      );

  const achats = somme("achat");
  const paniers = somme("panier");

  return {
    ...metrics,
    purchases: metrics.purchases + achats.count,
    purchaseValue: metrics.purchaseValue + achats.value,
    addToCart: metrics.addToCart + paniers.count,
  };
}
