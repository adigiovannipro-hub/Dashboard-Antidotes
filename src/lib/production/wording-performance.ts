/**
 * Ce qu'un texte publié a produit — **module pur**, zéro import Supabase.
 *
 * ── Pourquoi ce fichier existe ────────────────────────────────────────────
 *
 * Les trois phases de génération travaillaient en circuit ouvert : les
 * intentions ne savaient rien de ce que le mois précédent avait donné, la
 * rédaction choisissait ses précédents par **récence** (`previous-wordings.ts`)
 * et le compte rendu récitait des chiffres. Personne ne fermait la boucle
 * entre ce qui a été publié, ce qu'il a donné, et ce qu'on écrit ensuite.
 *
 * Le pont existe pourtant sans aucune jointure : `social_posts.caption` porte
 * le **texte réellement publié**, à côté de sa portée, de ses interactions et
 * de ses clics. Les deux autres chemins sont piégés — `planning_publications`
 * enregistre pour une vidéo Facebook un identifiant que `/published_posts` ne
 * rend jamais, et `wording_history.subject_id` ne couvre que les textes passés
 * par la génération. On part donc de la légende, et d'elle seule.
 *
 * ── Ce que ce module ne fait pas ──────────────────────────────────────────
 *
 * Il ne **classe pas** un hook en « question », « preuve sociale » ou
 * « affirmation clivante ». Cette lecture-là demande de comprendre le texte,
 * c'est le travail du modèle et le prompt la lui demande explicitement. Ici on
 * ne produit que des faits : le texte exact, et le chiffre qui l'étaye.
 *
 * ── Les ratios ────────────────────────────────────────────────────────────
 *
 * Comme partout, un taux se recalcule depuis les agrégats de l'ensemble
 * considéré. Le taux d'un groupe de publications est donc la somme de leurs
 * interactions rapportée à la somme de leurs portées, jamais la moyenne de
 * leurs taux : une publication confidentielle y pèserait autant qu'un reel vu
 * cent mille fois.
 */

import { extractAccroche } from "@/lib/context/accroche";

/**
 * La légende retenue à la collecte. 80 caractères — la borne d'avant — c'est
 * le hook et rien d'autre : l'appel à l'action vit à la fin d'une légende, et
 * l'analyser était donc matériellement impossible. 600 laisse passer une
 * caption entière dans l'immense majorité des cas sans doubler le prompt.
 */
export const MAX_COLLECTED_CAPTION_CHARS = 600;

/** Une publication mesurée : son texte publié, et ce qu'il a produit. */
export type MeasuredPost = {
  /** La légende telle qu'elle a été publiée, bornée à la collecte. */
  caption: string;
  /** `YYYY-MM-DD`. */
  publishedAt: string;
  /** Libellé du réseau, en français — « Instagram », « LinkedIn »… */
  platform: string;
  /** Libellé du format — « Reel », « Carrousel », « Publication ». */
  mediaKind: string;
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  /**
   * Clics sur la publication. `null` quand le réseau ne les rend pas — Meta
   * n'en donne aucun par publication, et afficher `0` ferait conclure au
   * modèle qu'aucun CTA ne convertit sur ce compte.
   */
  clicks: number | null;
  permalink: string | null;
};

/** Les trois morceaux d'une légende, tels que la rédaction les pense. */
export type CaptionParts = {
  /** La première ligne pleine, celle qui ouvre le post. */
  hook: string;
  /** Ce qui reste entre l'accroche et l'appel à l'action. */
  body: string;
  /** L'appel à l'action final, ou `null` quand la légende n'en porte aucun. */
  cta: string | null;
};

// --- Découpe d'une légende ----------------------------------------------------

/** Au-delà, un « CTA » est un paragraphe : la phrase finale n'en est plus une. */
const MAX_CTA_CHARS = 220;

/**
 * Les verbes d'appel à l'action, aux deux personnes — le tutoiement et le
 * vouvoiement cohabitent d'un client à l'autre. Liste volontairement courte :
 * un faux positif ferait passer une phrase de corps pour un CTA, ce qui
 * apprendrait au modèle exactement le contraire de ce qu'on veut.
 */
const CTA_VERBS = [
  "abonne",
  "abonnez",
  "appelle",
  "appelez",
  "clique",
  "cliquez",
  "commande",
  "commandez",
  "commente",
  "commentez",
  "contacte",
  "contactez",
  "demande",
  "demandez",
  "dis",
  "dites",
  "découvre",
  "découvrez",
  "enregistre",
  "enregistrez",
  "essaie",
  "essayez",
  "fonce",
  "foncez",
  "identifie",
  "identifiez",
  "inscris",
  "inscrivez",
  "partage",
  "partagez",
  "passe",
  "passez",
  "profite",
  "profitez",
  "raconte",
  "racontez",
  "regarde",
  "regardez",
  "rejoins",
  "rejoignez",
  "réponds",
  "répondez",
  "réserve",
  "réservez",
  "retrouve",
  "retrouvez",
  "suis",
  "suivez",
  "tague",
  "taguez",
  "télécharge",
  "téléchargez",
  "vends",
  "venez",
  "viens",
  "écris",
  "écrivez",
];

/** Les tournures qui valent CTA sans porter de verbe à l'impératif. */
const CTA_PHRASES = [
  "lien en bio",
  "lien dans la bio",
  "lien dans notre bio",
  "lien en commentaire",
  "lien ci-dessous",
  "on vous attend",
  "on t'attend",
  "rendez-vous",
  "à vous de jouer",
  "dispo en boutique",
  "disponible en boutique",
  "en magasin",
  "prenez rendez-vous",
];

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Une ligne qui n'est plus qu'un paquet de hashtags n'est pas un CTA. */
function isHashtagOnly(line: string): boolean {
  const stripped = line.replace(/#[\p{L}\p{N}_]+/gu, "").trim();
  return line.includes("#") && stripped.replace(/[\p{P}\p{S}\s]/gu, "") === "";
}

function looksLikeCta(sentence: string): boolean {
  const normalized = normalizeForMatch(sentence);
  if (normalized === "") return false;
  if (/[?]\s*$/.test(sentence.trim())) return true;
  if (CTA_PHRASES.some((phrase) => normalized.includes(normalizeForMatch(phrase)))) return true;
  // Le verbe doit **ouvrir** la phrase : « découvrez » en tête est une
  // injonction, « nous découvrons » au milieu d'un récit n'en est pas une.
  const firstWord = normalized.split(/[^\p{L}'-]+/u).find((word) => word !== "") ?? "";
  return CTA_VERBS.some((verb) => firstWord === normalizeForMatch(verb));
}

/** Découpe grossière en phrases : on n'a besoin que des dernières. */
function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence !== "");
}

/**
 * Découpe une légende en accroche / corps / appel à l'action.
 *
 * L'accroche réutilise `extractAccroche`, celle qui alimente déjà
 * `wording_history` : deux définitions de « l'accroche » finiraient par
 * diverger, et l'anti-répétition comparerait alors deux choses différentes.
 *
 * Le CTA se prend sur les **dernières** phrases, impératives ou
 * interrogatives. Quand aucune n'en est une, il vaut `null` : une légende sans
 * appel à l'action est une information, pas un trou à combler.
 */
export function splitCaption(caption: string): CaptionParts {
  const hook = extractAccroche(caption);
  const afterHook = caption.slice(caption.indexOf(hook) + hook.length);

  const lines = afterHook
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !isHashtagOnly(line));

  let cta: string | null = null;
  let ctaLine = -1;

  for (let index = lines.length - 1; index >= 0 && cta === null; index -= 1) {
    const sentences = sentencesOf(lines[index]!);
    for (let cursor = sentences.length - 1; cursor >= 0; cursor -= 1) {
      const candidate = sentences.slice(cursor).join(" ").trim();
      if (candidate.length > MAX_CTA_CHARS) break;
      if (looksLikeCta(sentences[cursor]!)) {
        cta = candidate;
        ctaLine = index;
        break;
      }
    }
  }

  // Le corps garde tout le reste, y compris ce qui précède le CTA sur sa propre
  // ligne : « Trois coloris disponibles. Réservez le vôtre. » n'est pas un CTA
  // de sept mots, c'est une phrase de corps suivie d'un CTA.
  const body =
    cta === null
      ? lines.join("\n")
      : [
          ...lines.slice(0, ctaLine),
          lines[ctaLine]!.slice(0, lines[ctaLine]!.length - cta.length).trim(),
          ...lines.slice(ctaLine + 1),
        ]
          .filter((line) => line !== "")
          .join("\n");

  return { hook, body, cta };
}

// --- Mesure -------------------------------------------------------------------

export function interactionsOf(post: MeasuredPost): number {
  return post.likes + post.comments + post.shares + post.saves;
}

/**
 * Le dénominateur d'un taux : la portée, et les impressions en repli.
 *
 * Même règle que l'écran et que le compte rendu — Meta ne rend pas toujours la
 * portée d'une publication. `0` signifie qu'il n'y a **rien à mesurer**.
 */
export function measurementBase(post: MeasuredPost): number {
  return post.reach > 0 ? post.reach : post.impressions;
}

/** Vrai dès qu'une publication porte de quoi calculer un taux. */
export function isMeasured(post: MeasuredPost): boolean {
  return measurementBase(post) > 0;
}

/**
 * Le taux d'engagement d'un **ensemble**, recalculé depuis ses agrégats.
 *
 * `null` quand rien n'est mesuré : c'est un trou, pas un zéro.
 */
export function engagementRate(posts: MeasuredPost[]): number | null {
  const measured = posts.filter(isMeasured);
  if (measured.length === 0) return null;
  const base = measured.reduce((sum, post) => sum + measurementBase(post), 0);
  if (base === 0) return null;
  const interactions = measured.reduce((sum, post) => sum + interactionsOf(post), 0);
  return (interactions / base) * 100;
}

/**
 * Le taux de clic d'un ensemble. `null` dès qu'aucune publication ne rend ses
 * clics — c'est le cas de tout Meta, et un `0 %` s'y lirait comme un échec des
 * appels à l'action.
 */
export function clickRate(posts: MeasuredPost[]): number | null {
  const measured = posts.filter((post) => isMeasured(post) && post.clicks !== null);
  if (measured.length === 0) return null;
  const base = measured.reduce((sum, post) => sum + measurementBase(post), 0);
  if (base === 0) return null;
  const clicks = measured.reduce((sum, post) => sum + (post.clicks ?? 0), 0);
  return (clicks / base) * 100;
}

function rateOf(post: MeasuredPost): number {
  return interactionsOf(post) / measurementBase(post);
}

/**
 * Les publications les plus — ou les moins — engageantes.
 *
 * Une publication sans mesure est **écartée des deux bouts** : à portée nulle
 * parce que le réseau n'a rien rendu, elle n'est pas une contre-performance,
 * elle est un trou. La classer en flop ferait tirer au modèle un enseignement
 * sur un texte dont personne ne sait ce qu'il a donné.
 */
export function rankByEngagement(
  posts: MeasuredPost[],
  options: { limit: number; worst?: boolean },
): MeasuredPost[] {
  const sorted = posts
    .filter(isMeasured)
    .sort((a, b) => (options.worst ? rateOf(a) - rateOf(b) : rateOf(b) - rateOf(a)));
  return sorted.slice(0, options.limit);
}

/**
 * Sous ce nombre de publications mesurées, « les moins bonnes » ne sont que
 * les autres : on ne désigne aucun flop sur un échantillon qui ne dit rien.
 */
export const MIN_MEASURED_FOR_WORST = 4;

/** Les moins engageantes, ou rien du tout si l'échantillon est trop maigre. */
export function pickWorst(posts: MeasuredPost[], limit: number): MeasuredPost[] {
  const measured = posts.filter(isMeasured);
  if (measured.length < MIN_MEASURED_FOR_WORST) return [];
  return rankByEngagement(measured, { limit, worst: true });
}

/** Les publications qui ont le plus fait cliquer — LinkedIn seul, aujourd'hui. */
export function rankByClickRate(
  posts: MeasuredPost[],
  options: { limit: number },
): MeasuredPost[] {
  return posts
    .filter((post) => isMeasured(post) && post.clicks !== null)
    .sort((a, b) => (b.clicks ?? 0) / measurementBase(b) - (a.clicks ?? 0) / measurementBase(a))
    .slice(0, options.limit);
}

/**
 * Rapproche un sujet du planning de la publication réellement mesurée, **par
 * le texte publié**.
 *
 * Rendre `null` dès que deux publications correspondent est délibéré : une
 * correspondance ambiguë n'est pas un fait, et imputer les chiffres de l'une
 * au texte de l'autre est exactement la faute qu'on s'interdit.
 */
/** Le préfixe comparé : au-delà, deux textes identiques au début divergent. */
const MATCH_PREFIX_CHARS = 60;

export function matchByCaption(
  posts: MeasuredPost[],
  wording: string | null,
): MeasuredPost | null {
  if (!wording) return null;
  const key = (text: string) => normalizeForMatch(text).replace(/[^\p{L}\p{N} ]/gu, "");
  const needle = key(wording);

  const matches = posts.filter((post) => {
    const hay = key(post.caption);
    // Le plus court des deux fait la comparaison : la cellule du planning
    // porte souvent le CTA que la légende publiée a perdu, et l'inverse arrive
    // quand la légende a été retouchée à la main avant publication.
    const length = Math.min(needle.length, hay.length, MATCH_PREFIX_CHARS);
    // Sous vingt caractères significatifs, un préfixe ne discrimine plus rien.
    if (length < 20) return false;
    return needle.slice(0, length) === hay.slice(0, length);
  });
  return matches.length === 1 ? matches[0]! : null;
}

// --- Rendu pour les prompts ---------------------------------------------------

/** Espace insécable fine, comme `src/lib/format.ts`. */
const NBSP = "\u202f";

function percent(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(2).replace(".", ",")}${NBSP}%`;
}

function integer(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** Deux blocs de textes complets doublent le prompt : chacun est borné. */
const MAX_BLOCK_CAPTION_CHARS = 600;
const MAX_SNIPPET_CHARS = 200;

function clamp(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Le chiffre qui étaye un texte, en une clause. */
function figuresOf(post: MeasuredPost): string {
  const base = measurementBase(post);
  const parts = [
    post.reach > 0
      ? `${integer(post.reach)} de portée`
      : post.impressions > 0
        ? `${integer(post.impressions)} impressions (portée non rendue)`
        : "aucune mesure rendue",
    `${integer(interactionsOf(post))} interactions`,
    `engagement ${percent(base > 0 ? (interactionsOf(post) / base) * 100 : null)}`,
  ];
  parts.push(
    post.clicks === null
      ? "clics non rendus par le réseau"
      : `${integer(post.clicks)} clics (${percent(base > 0 ? (post.clicks / base) * 100 : null)})`,
  );
  return parts.join(", ");
}

function postHeader(post: MeasuredPost): string {
  return `${post.publishedAt} · ${post.platform} · ${post.mediaKind} — ${figuresOf(post)}`;
}

/**
 * `{{wordings_mesures}}` — les textes publiés **avec ce qu'ils ont donné**.
 *
 * C'est ce bloc qui distingue un wording validé (le registre du client) d'un
 * wording performant (une mécanique à reproduire) : `previous-wordings.ts`
 * choisit par récence, il ne sait rien de la performance.
 */
export function renderMeasuredWordings(
  posts: MeasuredPost[],
  options: { limit?: number } = {},
): string {
  const best = rankByEngagement(posts, { limit: options.limit ?? 5 });
  if (best.length === 0) return "";
  return best
    .map((post, index) => {
      const parts = splitCaption(post.caption);
      return [
        `--- Wording mesuré ${index + 1} — ${postHeader(post)} ---`,
        clamp(post.caption, MAX_BLOCK_CAPTION_CHARS),
        `(accroche : « ${clamp(parts.hook, MAX_SNIPPET_CHARS)} » · appel à l'action : ${
          parts.cta === null ? "aucun identifié" : `« ${clamp(parts.cta, MAX_SNIPPET_CHARS)} »`
        })`,
      ].join("\n");
    })
    .join("\n\n");
}

/** `{{hooks_performants}}` — les accroches qui ont ouvert, chiffre à l'appui. */
export function renderWinningHooks(
  posts: MeasuredPost[],
  options: { limit?: number } = {},
): string {
  const best = rankByEngagement(posts, { limit: options.limit ?? 6 });
  if (best.length === 0) return "";
  const lines = best.map(
    (post) =>
      `- « ${clamp(splitCaption(post.caption).hook, MAX_SNIPPET_CHARS)} » — ${figuresOf(post)}`,
  );
  const overall = engagementRate(best);
  return [
    ...lines,
    `Ensemble de ces accroches : ${percent(overall)} d'engagement, recalculé sur la somme des portées.`,
  ].join("\n");
}

/**
 * `{{cta_performants}}` — les appels à l'action qui ont fait cliquer quand le
 * réseau rend les clics, à défaut ceux des publications les plus engageantes.
 */
export function renderWinningCtas(
  posts: MeasuredPost[],
  options: { limit?: number } = {},
): string {
  const limit = options.limit ?? 6;
  const byClicks = rankByClickRate(posts, { limit });
  const source = byClicks.length > 0 ? byClicks : rankByEngagement(posts, { limit });
  const withCta = source
    .map((post) => ({ post, cta: splitCaption(post.caption).cta }))
    .filter((entry): entry is { post: MeasuredPost; cta: string } => entry.cta !== null);
  if (withCta.length === 0) return "";

  const lines = withCta.map(
    (entry) => `- « ${clamp(entry.cta, MAX_SNIPPET_CHARS)} » — ${figuresOf(entry.post)}`,
  );
  if (byClicks.length === 0) {
    lines.push(
      "Aucun réseau de ce client ne rend les clics par publication : ces appels à l'action sont classés par engagement, pas par clic.",
    );
  }
  return lines.join("\n");
}

/**
 * `{{formules_a_retirer}}` — les accroches et appels à l'action des
 * publications les moins engageantes, **mesurées**.
 */
export function renderFormulasToDrop(
  posts: MeasuredPost[],
  options: { limit?: number } = {},
): string {
  const worst = pickWorst(posts, options.limit ?? 3);
  return worst
    .map((post) => {
      const parts = splitCaption(post.caption);
      const cta =
        parts.cta === null ? "aucun appel à l'action" : `« ${clamp(parts.cta, MAX_SNIPPET_CHARS)} »`;
      return `- « ${clamp(parts.hook, MAX_SNIPPET_CHARS)} » / ${cta} — ${figuresOf(post)}`;
    })
    .join("\n");
}

/**
 * `{{top_posts_mesures}}` — une ligne par publication, pour les intentions.
 *
 * La phase Intentions n'a pas besoin du texte entier : elle cherche la
 * mécanique, pas la formulation. Le corps resterait de toute façon inutilisable
 * — elle produit un angle, pas une caption.
 */
export function renderTopPostsSummary(
  posts: MeasuredPost[],
  options: { limit?: number } = {},
): string {
  const best = rankByEngagement(posts, { limit: options.limit ?? 8 });
  if (best.length === 0) return "";
  return best
    .map((post) => {
      const parts = splitCaption(post.caption);
      const cta = parts.cta === null ? "sans appel à l'action" : `CTA « ${clamp(parts.cta, 120)} »`;
      return `- ${postHeader(post)}\n  accroche « ${clamp(parts.hook, 160)} » · ${cta}`;
    })
    .join("\n");
}
