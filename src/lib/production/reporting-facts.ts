/**
 * Ce que la phase Reporting donne à lire au modèle — **fonctions pures**,
 * zéro import Supabase. La lecture vit dans `generate.ts`, avec les autres.
 *
 * ── Pourquoi ce fichier existe ────────────────────────────────────────────
 *
 * La phase ne regardait que le planning : « 8 publiés sur 12 prévus », réseau
 * par réseau. Le prompt disait même au modèle, en toutes lettres, que « les
 * données de portée et d'engagement des régies ne sont pas encore branchées ».
 * C'était vrai à l'écriture. Ça ne l'est plus : le connecteur Meta remplit
 * `ad_metrics_daily`, `social_posts` et `social_followers`, et la page
 * Reporting les affiche. Le compte rendu s'interdisait des chiffres posés à
 * côté de lui.
 *
 * Les volumes du planning ne disparaissent pas pour autant : ils disent ce qui
 * était **prévu**, ce qu'aucune régie ne sait. Les deux se complètent — les
 * régies pour la performance, le planning pour la tenue du contrat.
 *
 * ── Les ratios ne sont jamais stockés ─────────────────────────────────────
 *
 * Comme partout ici, seules les grandeurs additives circulent : CPA, ROAS,
 * CTR et taux d'engagement sont recalculés au moment du rendu, depuis les
 * agrégats de la période. Une moyenne de moyennes est fausse.
 */

import type { RawMetrics } from "@/lib/metrics/types";

/** Un réseau organique tel que le connecteur le remplit. */
export type OrganicPlatform = "instagram" | "facebook";

export const ORGANIC_LABELS: Record<OrganicPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
};

export type OrganicFacts = {
  platform: OrganicPlatform;
  /** Publications relevées sur la période, et sur le mois d'avant. */
  posts: number;
  previousPosts: number;
  total: RawMetrics;
  previousTotal: RawMetrics;
  /** Dernier relevé d'abonnés de la période, et celui d'avant. `null` si aucun. */
  followers: number | null;
  previousFollowers: number | null;
  /** Les publications les plus vues, déjà triées et coupées. */
  top: { name: string; publishedAt: string; reach: number; engagement: number }[];
};

export type ReportingFacts = {
  /** Mois analysé, `YYYY-MM-01`. */
  month: string;
  ads: { total: RawMetrics; previousTotal: RawMetrics } | null;
  organic: OrganicFacts[];
  /** Ce que le planning prévoyait, réseau par réseau. */
  planning: { platform: string; planned: number; published: number }[];
  previousPlanning: { platform: string; planned: number; published: number }[];
};

export const EMPTY_FACTS: Omit<ReportingFacts, "month"> = {
  ads: null,
  organic: [],
  planning: [],
  previousPlanning: [],
};

/** Vrai dès qu'une source réelle a quelque chose à dire sur la période. */
export function hasRealData(facts: ReportingFacts): boolean {
  if (facts.ads !== null) return true;
  return facts.organic.some((entry) => entry.posts > 0 || entry.followers !== null);
}

/** Y a-t-il de quoi écrire un compte rendu, quelle que soit la source ? */
export function hasAnything(facts: ReportingFacts): boolean {
  return hasRealData(facts) || facts.planning.length > 0;
}

// --- Mise en forme ------------------------------------------------------------

/** Espace insécable fine, comme `src/lib/format.ts` : `2 572,22 €`. */
const NBSP = "\u202f";

/** `2 572,22` — même convention que l'écran, sans dépendre de `Intl` ici. */
function number(value: number, decimals = 0): string {
  const fixed = value.toFixed(decimals);
  const [whole, fraction] = fixed.split(".");
  const spaced = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return fraction ? `${spaced},${fraction}` : spaced;
}

/** Une variation en pourcentage, ou `N/A` quand la comparaison n'existe pas. */
export function delta(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? "N/A" : "nouveau";
  const change = ((current - previous) / previous) * 100;
  const sign = change > 0 ? "+" : "";
  return `${sign}${number(change, 1)}${NBSP}%`;
}

/** Un ratio recalculé depuis les agrégats, jamais stocké. `—` si indéfini. */
function ratio(numerator: number, denominator: number, decimals = 2): string {
  if (denominator === 0) return "—";
  return number(numerator / denominator, decimals);
}

function adsLines(total: RawMetrics, previous: RawMetrics): string[] {
  return [
    `- Dépense : ${number(total.spend, 2)}${NBSP}€ (${delta(total.spend, previous.spend)})`,
    `- Impressions : ${number(total.impressions)} (${delta(total.impressions, previous.impressions)})`,
    `- Portée : ${number(total.reach)} (${delta(total.reach, previous.reach)})`,
    `- Clics sur lien : ${number(total.linkClicks)} (${delta(total.linkClicks, previous.linkClicks)})`,
    `- CTR : ${ratio(total.linkClicks * 100, total.impressions)}${NBSP}%`,
    `- CPC : ${ratio(total.spend, total.clicks)}${NBSP}€`,
    `- Achats : ${number(total.purchases)} (${delta(total.purchases, previous.purchases)})`,
    `- Coût par achat : ${ratio(total.spend, total.purchases)}${NBSP}€`,
    `- Chiffre d'affaires : ${number(total.purchaseValue, 2)}${NBSP}€ (${delta(total.purchaseValue, previous.purchaseValue)})`,
    `- ROAS : ${ratio(total.purchaseValue, total.spend)}`,
  ];
}

function organicLines(entry: OrganicFacts): string[] {
  const interactions =
    entry.total.likes + entry.total.comments + entry.total.shares + entry.total.saves;
  const previousInteractions =
    entry.previousTotal.likes +
    entry.previousTotal.comments +
    entry.previousTotal.shares +
    entry.previousTotal.saves;
  // Le dénominateur du taux d'engagement est la portée, et les vues en repli :
  // Meta ne rend pas toujours la portée d'une publication. Même règle que
  // `organic-dashboard.tsx`, pour que les deux racontent la même chose.
  const base = entry.total.reach > 0 ? entry.total.reach : entry.total.videoViews;

  const lines = [
    `- Publications : ${number(entry.posts)} (${delta(entry.posts, entry.previousPosts)})`,
    `- Portée : ${entry.total.reach > 0 ? number(entry.total.reach) : "—"} (${delta(entry.total.reach, entry.previousTotal.reach)})`,
    `- Interactions : ${number(interactions)} (${delta(interactions, previousInteractions)})`,
    `- Taux d'engagement : ${ratio(interactions * 100, base)}${NBSP}%${
      entry.total.reach === 0 && entry.total.videoViews > 0 ? " (calculé sur les vues, portée absente)" : ""
    }`,
  ];

  if (entry.followers !== null) {
    const gain =
      entry.previousFollowers === null ? null : entry.followers - entry.previousFollowers;
    lines.push(
      `- Abonnés : ${number(entry.followers)}${
        gain === null ? "" : ` (${gain >= 0 ? "+" : ""}${number(gain)} sur le mois)`
      }`,
    );
  }

  for (const post of entry.top) {
    lines.push(
      `  · ${post.publishedAt} — « ${post.name} » : ${post.reach > 0 ? `${number(post.reach)} de portée` : "portée non rendue"}, ${number(post.engagement)} interactions`,
    );
  }

  return lines;
}

function planningLines(
  rows: { platform: string; planned: number; published: number }[],
): string[] {
  if (rows.length === 0) return ["- Aucune ligne au planning."];
  return rows.map(
    (row) =>
      `- ${row.platform} : ${row.published} publié${row.published > 1 ? "s" : ""} sur ${row.planned} prévu${row.planned > 1 ? "s" : ""}`,
  );
}

/**
 * Le bloc de chiffres injecté dans le prompt.
 *
 * Il dit explicitement ce qui **manque**, plutôt que de laisser un silence :
 * un modèle à qui l'on ne parle pas de portée en invente une tournure vague,
 * là où « aucun compte publicitaire branché » se répercute honnêtement dans
 * le compte rendu.
 */
export function renderReportingFacts(facts: ReportingFacts): string {
  const blocks: string[] = [];

  blocks.push(
    facts.ads
      ? ["## Publicité (Meta Ads)", ...adsLines(facts.ads.total, facts.ads.previousTotal)].join(
          "\n",
        )
      : "## Publicité (Meta Ads)\nAucun compte publicitaire branché pour cet espace : ne rien affirmer sur le payant.",
  );

  if (facts.organic.length > 0) {
    for (const entry of facts.organic) {
      blocks.push(
        [`## Organique — ${ORGANIC_LABELS[entry.platform]}`, ...organicLines(entry)].join("\n"),
      );
    }
  } else {
    blocks.push(
      "## Organique\nAucun compte social relevé pour cet espace : ne rien affirmer sur l'organique.",
    );
  }

  blocks.push(
    [
      "## Tenue du planning éditorial",
      ...planningLines(facts.planning),
      "",
      "Mois précédent, pour comparaison :",
      ...planningLines(facts.previousPlanning),
    ].join("\n"),
  );

  if (!hasRealData(facts)) {
    blocks.push(
      "## Avertissement\nAucune donnée de régie n'est disponible pour ce mois. Le compte rendu ne porte que sur les volumes du planning : ne donner aucun chiffre de portée, d'engagement ou de dépense, et le dire.",
    );
  }

  return blocks.join("\n\n");
}
