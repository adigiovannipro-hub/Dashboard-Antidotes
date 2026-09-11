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
import {
  interactionsOf,
  measurementBase,
  splitCaption,
  type MeasuredPost,
} from "./wording-performance";

/**
 * Les réseaux dont un relevé organique existe — les mêmes quatre que
 * `src/lib/reporting/queries.ts`. LinkedIn et TikTok en étaient absents ici,
 * si bien que le compte rendu d'un client vendu sur LinkedIn ne parlait que de
 * son planning : or LinkedIn est la **seule** source qui rende les clics par
 * publication, donc la seule qui puisse dire quel appel à l'action convertit.
 */
export type OrganicPlatform = "instagram" | "facebook" | "linkedin" | "tiktok";

export const ORGANIC_LABELS: Record<OrganicPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
};

/**
 * Ce réseau rend-il les clics **par publication** ?
 *
 * LinkedIn seul, aujourd'hui (`social_posts.clicks`, migration 20260902f).
 * Meta ne les rend jamais — la colonne reste à zéro, et présenter ce zéro
 * comme une mesure ferait conclure au modèle qu'aucun CTA ne convertit sur ce
 * compte. Ailleurs, le fait porte `null` et le rendu le dit.
 */
export function rendersPostClicks(platform: OrganicPlatform): boolean {
  return platform === "linkedin";
}

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
  /** Les publications les plus engageantes, déjà triées et coupées. */
  top: MeasuredPost[];
  /**
   * Les moins engageantes, **mesurées uniquement**. Une publication à portée
   * nulle parce que le réseau n'a rien rendu n'est pas un flop, c'est un trou :
   * la ranger là ferait tirer un enseignement d'un texte dont personne ne sait
   * ce qu'il a donné.
   */
  flop: MeasuredPost[];
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

  lines.push(
    rendersPostClicks(entry.platform)
      ? `- Clics : ${number(entry.total.clicks)} (${delta(entry.total.clicks, entry.previousTotal.clicks)})`
      : "- Clics par publication : non rendus par ce réseau. Ne conclure ni sur le clic, ni sur ce qu'un appel à l'action a converti ici.",
  );

  if (entry.followers !== null) {
    const gain =
      entry.previousFollowers === null ? null : entry.followers - entry.previousFollowers;
    lines.push(
      `- Abonnés : ${number(entry.followers)}${
        gain === null ? "" : ` (${gain >= 0 ? "+" : ""}${number(gain)} sur le mois)`
      }`,
    );
  }

  return lines;
}

/**
 * Le détail publication par publication — `{{posts_data}}`.
 *
 * C'est **la** matière de l'analyse éditoriale : le texte réellement publié,
 * découpé en accroche et appel à l'action, à côté de ce qu'il a produit. Sans
 * lui, le prompt n'avait que des agrégats et ne pouvait rien dire d'autre que
 * les chiffres que le client lit déjà sur son écran.
 *
 * La légende était jusqu'ici coupée à 80 caractères : de quoi reconnaître un
 * post, jamais de quoi voir son CTA, qui vit à la fin. Analyser les appels à
 * l'action était donc matériellement impossible.
 */
export function renderOrganicPosts(facts: ReportingFacts): string {
  const blocks: string[] = [];

  for (const entry of facts.organic) {
    const label = ORGANIC_LABELS[entry.platform];
    const lines: string[] = [];

    if (entry.top.length > 0) {
      lines.push(`Les plus engageantes sur ${label} :`, ...entry.top.map(postDetail));
    }
    if (entry.flop.length > 0) {
      lines.push("", `Les moins engageantes sur ${label} (mesurées) :`, ...entry.flop.map(postDetail));
    }
    if (lines.length > 0) blocks.push(lines.join("\n"));
  }

  return blocks.join("\n\n");
}

function postDetail(post: MeasuredPost): string {
  const parts = splitCaption(post.caption);
  const base = measurementBase(post);
  const figures = [
    post.reach > 0
      ? `portée ${number(post.reach)}`
      : post.impressions > 0
        ? `impressions ${number(post.impressions)} (portée non rendue)`
        : "aucune mesure rendue",
    `interactions ${number(interactionsOf(post))}`,
    `engagement ${base > 0 ? `${ratio(interactionsOf(post) * 100, base)}${NBSP}%` : "—"}`,
    post.clicks === null
      ? "clics non rendus"
      : `clics ${number(post.clicks)} (${base > 0 ? `${ratio(post.clicks * 100, base)}${NBSP}%` : "—"})`,
  ].join(" · ");

  return [
    `- ${post.publishedAt} · ${post.mediaKind} · ${figures}`,
    `  accroche : « ${parts.hook} »`,
    `  appel à l'action : ${parts.cta === null ? "aucun identifié" : `« ${parts.cta} »`}`,
    `  légende publiée : ${post.caption.replace(/\n+/g, " ⏎ ")}`,
    ...(post.permalink ? [`  lien : ${post.permalink}`] : []),
  ].join("\n");
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
