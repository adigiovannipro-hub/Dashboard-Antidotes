/**
 * La lecture des réponses LinkedIn — pur, sans réseau ni base.
 *
 * Toutes les formes reconnues ici l'ont été **sur pièce**, contre le vrai
 * service, le 2 septembre 2026. Deviner la forme d'une réponse a déjà coûté
 * un « ce compte n'administre aucune page » sur un compte qui en administre
 * six : rien n'est supposé.
 */
import type {
  LinkedinDay,
  LinkedinFollowerGain,
  LinkedinPage,
  LinkedinPageViews,
  LinkedinPost,
  LinkedinShareStats,
} from "./types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Un nombre, jamais négatif.
 *
 * LinkedIn rend **−1** pour « je ne sais pas » : vu sur `shareCount` en
 * novembre 2025. Le laisser passer ferait un total qui recule.
 */
function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Le jour UTC d'un instant en millisecondes. */
export function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Le 1er du mois UTC d'un instant en millisecondes. */
export function utcMonth(ms: number): string {
  return `${new Date(ms).toISOString().slice(0, 7)}-01`;
}

/** Les éléments d'une réponse RestLi, quelle que soit son enveloppe. */
function elements(payload: unknown): Record<string, unknown>[] {
  const list = asRecord(payload)?.elements;
  if (!Array.isArray(list)) return [];
  const found: Record<string, unknown>[] = [];
  for (const item of list as unknown[]) {
    const record = asRecord(item);
    if (record) found.push(record);
  }
  return found;
}

/** Les grandeurs d'un bloc `totalShareStatistics`. */
function shareStats(stats: Record<string, unknown> | null): LinkedinShareStats {
  return {
    impressions: count(stats?.impressionCount),
    reach: count(stats?.uniqueImpressionsCount),
    clicks: count(stats?.clickCount),
    likes: count(stats?.likeCount),
    comments: count(stats?.commentCount),
    shares: count(stats?.shareCount),
  };
}

/** L'identifiant numérique d'une organisation, depuis son URN. */
export function organizationId(urn: string): string | null {
  return /^urn:li:organization:(\d+)$/.exec(urn)?.[1] ?? null;
}

/** Le nom lisible d'une organisation, quel que soit le champ qui le porte. */
function organizationName(org: Record<string, unknown>): string {
  const localized = org.localizedName;
  if (typeof localized === "string" && localized) return localized;
  const values = asRecord(asRecord(org.name)?.localized);
  const first = values ? Object.values(values)[0] : null;
  if (typeof first === "string" && first) return first;
  return text(org.vanityName) ?? "Page LinkedIn";
}

/**
 * Les pages d'une réponse « organisations où j'ai un rôle ».
 *
 * Trois formes acceptées, parce que la passerelle en rend au moins deux :
 * une fiche d'organisation seule (le cas réel — elle **résout** déjà l'ACL),
 * une liste de fiches, une liste d'ACL portant l'URN. Une forme inconnue
 * rend une liste vide, jamais une exception : l'appelant montre alors la
 * réponse brute plutôt que de conclure.
 */
export function pagesFromOrganizations(payload: unknown): LinkedinPage[] {
  const root = asRecord(payload);
  if (!root) return [];

  const collect = (value: unknown): LinkedinPage[] => {
    const org = asRecord(value);
    if (!org) return [];

    if (typeof org.id === "number" || typeof org.id === "string") {
      return [
        {
          id: String(org.id),
          name: organizationName(org),
          vanityName: text(org.vanityName),
          logoUrl: text(asRecord(org.logoV2)?.original),
        },
      ];
    }

    const urn = org.organization;
    if (typeof urn === "string") {
      const id = organizationId(urn);
      return id ? [{ id, name: `Page ${id}`, vanityName: null, logoUrl: null }] : [];
    }
    return [];
  };

  const list = root.elements;
  if (Array.isArray(list)) return list.flatMap(collect);
  return collect(root);
}

/** Le nombre d'abonnés d'une page, ou `null` si la réponse n'en porte pas. */
export function followersFromNetworkSize(payload: unknown): number | null {
  const size = asRecord(payload)?.firstDegreeSize;
  return typeof size === "number" && Number.isFinite(size) ? size : null;
}

/**
 * Les statistiques de la page, un élément par jour.
 *
 * Chaque élément porte son `timeRange` : c'est **le début** qui date la
 * journée, jamais l'ordre dans la liste. Une réponse partielle — LinkedIn
 * saute les jours sans activité — se lit alors sans décalage.
 */
export function dailyFromShareStats(payload: unknown): LinkedinDay[] {
  return elements(payload).flatMap((element) => {
    const start = asRecord(element.timeRange)?.start;
    if (typeof start !== "number") return [];
    return [
      {
        date: utcDay(start),
        ...shareStats(asRecord(element.totalShareStatistics)),
      },
    ];
  });
}

/**
 * Les visites de la page, un élément par jour.
 *
 * Sondé sur pièce (ANMF, août 2026) : trente et un éléments au grain jour,
 * 316 vues et 128 uniques au total du mois dont 42 sur l'onglet Emplois.
 * Le `timeRange` date l'élément, comme pour les statistiques de contenu —
 * ce sont des mesures d'intervalle et non des instantanés : aucune veille à
 * appliquer, le jour mesuré est celui qui commence l'intervalle.
 */
export function pageViewsFromStatistics(payload: unknown): LinkedinPageViews[] {
  return elements(payload).flatMap((element) => {
    const start = asRecord(element.timeRange)?.start;
    if (typeof start !== "number") return [];
    const views = asRecord(asRecord(element.totalPageStatistics)?.views);
    const bloc = (key: string) => asRecord(views?.[key]);
    const all = bloc("allPageViews");
    const jobs = bloc("jobsPageViews");
    return [
      {
        date: utcDay(start),
        pageViews: count(all?.pageViews),
        uniquePageViews: count(all?.uniquePageViews),
        jobsPageViews: count(jobs?.pageViews),
      },
    ];
  });
}

/**
 * Les vignettes d'un lot de médias.
 *
 * Trois familles, trois réponses différentes, toutes sondées : une **vidéo**
 * porte un champ `thumbnail` (une image) à côté de son `downloadUrl` (le
 * mp4) — c'est la vignette qu'on veut, pas la vidéo ; une **image** n'a que
 * son `downloadUrl`, qui est l'image ; un **document** n'a qu'un PDF, dont
 * on ne peut rien tirer sans le rendre, donc rien.
 *
 * Ces URL **périment** (`downloadUrlExpiresAt`, une semaine environ) : elles
 * se réécrivent à chaque passage, ce que la fenêtre glissante du connecteur
 * fait naturellement.
 */
export function mediaThumbnails(payload: unknown): Map<string, string> {
  const byUrn = new Map<string, string>();
  const results = asRecord(asRecord(payload)?.results);
  for (const [urn, value] of Object.entries(results ?? {})) {
    const media = asRecord(value);
    if (!media) continue;
    const url = text(media.thumbnail) ?? (urn.startsWith("urn:li:document:") ? null : text(media.downloadUrl));
    if (url) byUrn.set(urn, url);
  }
  return byUrn;
}

/** Les statistiques par publication, indexées par URN. */
export function statsByPost(payload: unknown): Map<string, LinkedinShareStats> {
  const byUrn = new Map<string, LinkedinShareStats>();
  for (const element of elements(payload)) {
    const urn = text(element.ugcPost) ?? text(element.share);
    if (!urn) continue;
    byUrn.set(urn, shareStats(asRecord(element.totalShareStatistics)));
  }
  return byUrn;
}

/**
 * Les gains d'abonnés d'une réponse mensuelle.
 *
 * Organique **et** payant additionnés : le client compte ses abonnés, pas
 * leur provenance. Le mois est celui du début de l'intervalle — LinkedIn
 * fait commencer le premier au lendemain de la borne demandée, d'où un
 * ancrage sur le 1er du mois plutôt que sur la date brute.
 */
export function followerGains(payload: unknown): LinkedinFollowerGain[] {
  return elements(payload).flatMap((element) => {
    const start = asRecord(element.timeRange)?.start;
    if (typeof start !== "number") return [];
    const gains = asRecord(element.followerGains);
    return [
      {
        month: utcMonth(start),
        gain: count(gains?.organicFollowerGain) + count(gains?.paidFollowerGain),
      },
    ];
  });
}

/**
 * Le type de média d'une publication.
 *
 * LinkedIn ne le nomme pas : il se déduit du contenu. Plusieurs médias =
 * carrousel, une vidéo = vidéo, tout le reste = publication simple —
 * document et article compris, qui se lisent comme une image dans un
 * tableau de performance.
 */
function mediaUrnOf(content: Record<string, unknown> | null): string | null {
  if (!content) return null;
  const media = asRecord(content.media);
  const single = text(media?.id);
  if (single) return single;
  /* Un carrousel porte ses images dans `multiImage.images[]` : on prend la
     première, celle qui sert de couverture dans le fil comme chez nous. */
  const multi = asRecord(content.multiImage);
  const images = Array.isArray(multi?.images) ? multi.images : [];
  for (const image of images) {
    const id = text(asRecord(image)?.id);
    if (id) return id;
  }
  return null;
}

function mediaKindOf(content: Record<string, unknown> | null): LinkedinPost["mediaKind"] {
  if (!content) return "image";
  if (Array.isArray(content.multiImage) || asRecord(content.multiImage)) return "carousel";
  const media = asRecord(content.media);
  const id = text(media?.id) ?? "";
  if (id.startsWith("urn:li:video:")) return "video";
  return "image";
}

/**
 * Les publications d'une page.
 *
 * Seules les publiées : un brouillon ou une publication programmée n'a pas
 * de performance à montrer, et la faire figurer au tableau ferait chercher
 * des chiffres qui n'existent pas.
 */
export function postsFromRest(payload: unknown): LinkedinPost[] {
  return elements(payload).flatMap((element) => {
    const urn = text(element.id);
    const publishedAt = element.publishedAt ?? element.createdAt;
    if (!urn || typeof publishedAt !== "number") return [];
    if (text(element.lifecycleState) !== "PUBLISHED") return [];

    return [
      {
        urn,
        publishedAt: new Date(publishedAt).toISOString(),
        commentary: decodeCommentary(text(element.commentary)),
        mediaKind: mediaKindOf(asRecord(element.content)),
        mediaUrn: mediaUrnOf(asRecord(element.content)),
      },
    ];
  });
}

/**
 * Le texte d'une publication, rendu lisible.
 *
 * LinkedIn ne rend pas du texte brut mais son format « Little Text » : les
 * caractères réservés sont échappés par une barre oblique inverse, les
 * hashtags sont des macros et les mentions portent l'URN de la personne ou
 * de l'organisation citée. Recopié tel quel dans un tableau, ça donne
 * « \#ChasseursDeGraines.fr » et « {hashtag|\#|Métiers} \| 🔬 » — illisible,
 * et vu à l'écran au premier passage réel.
 *
 * Trois passes, dans cet ordre : les macros et les mentions d'abord — elles
 * contiennent elles-mêmes des échappements —, le déséchappement ensuite.
 * L'inverse transformerait `{hashtag\|…}` en macro et casserait la suivante.
 */
export function decodeCommentary(text: string | null): string | null {
  if (!text) return null;
  return (
    text
      // `{hashtag|\#|Métiers}` → `#Métiers`
      .replace(/\{hashtag\|\\?#\|([^}]*)\}/g, "#$1")
      // `@[INTERCEREALES](urn:li:organization:45571640)` → `@INTERCEREALES`
      .replace(/@\[([^\]]*)\]\(urn:li:[^)]*\)/g, "@$1")
      // `\|`, `\(`, `\#`… → le caractère lui-même.
      .replace(/\\(.)/g, "$1")
  );
}

/**
 * Le lien public d'une publication.
 *
 * LinkedIn ne rend pas de permalien : il se fabrique depuis l'URN, et c'est
 * la forme que l'interface de LinkedIn elle-même utilise.
 */
export function permalinkOf(urn: string): string {
  return `https://www.linkedin.com/feed/update/${urn}/`;
}

/**
 * La courbe d'abonnés reconstruite depuis les gains mensuels.
 *
 * LinkedIn ne rend pas l'historique du nombre d'abonnés, seulement le total
 * du jour et les **gains** de chaque mois. On remonte donc le temps :
 * le compte à la fin d'un mois est le compte d'aujourd'hui moins les gains
 * de tous les mois qui ont suivi. C'est ce qui donne treize mois de courbe
 * dès le premier passage, là où Meta repart de zéro.
 *
 * Le point est daté du **dernier jour du mois** : c'est le jour qu'il
 * clôture, règle commune à tous les relevés d'abonnés du projet.
 */
export function followersHistory(
  gains: readonly LinkedinFollowerGain[],
  followersNow: number,
  /** Le jour que le relevé du jour clôture : rien ne se date au-delà. */
  until: string,
): { date: string; followers: number }[] {
  // Du plus récent au plus ancien : chaque mois retire son propre gain.
  const ordered = [...gains].sort((a, b) => b.month.localeCompare(a.month));
  const points: { date: string; followers: number }[] = [];
  let running = followersNow;

  for (const { month, gain } of ordered) {
    running -= gain;
    if (running < 0) break;
    const end = new Date(`${month}T00:00:00Z`);
    // Le dernier jour du mois : le 0 du mois suivant, en UTC.
    const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0));
    const date = lastDay.toISOString().slice(0, 10);
    /* Le mois en cours n'a pas de dernier jour révolu : son « 30 septembre »
       tomberait dans le futur, et un relevé daté d'un jour qui n'existe pas
       encore est un mensonge — même quand le chiffre, lui, est juste. */
    if (date > until) continue;
    points.push({
      date,
      // Le compte **au début** du mois est celui de la fin du mois d'avant.
      followers: running,
    });
  }

  return points.reverse();
}
