/**
 * La lecture des réponses LinkedIn — pur, sans réseau ni base.
 *
 * Toutes les formes reconnues ici l'ont été **sur pièce**, contre le vrai
 * service, le 2 septembre 2026 : la documentation de la passerelle décrit
 * des ACL d'organisation, le service rend des fiches d'organisation déjà
 * résolues. Deviner la forme d'une réponse a coûté un « ce compte
 * n'administre aucune page » sur un compte qui en administre six.
 */
import {
  EMPTY_LIFETIME_TOTALS,
  type LinkedinLifetimeTotals,
  type LinkedinPage,
} from "./types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
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
  const vanity = org.vanityName;
  return typeof vanity === "string" && vanity ? vanity : "Page LinkedIn";
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Les pages d'une réponse « organisations où j'ai un rôle ».
 *
 * Trois formes acceptées, parce que la passerelle en rend au moins deux : une
 * fiche d'organisation seule (le cas réel), une liste de fiches, une liste
 * d'ACL portant l'URN. Une forme inconnue rend une liste vide — jamais une
 * exception : l'appelant montre alors la réponse brute plutôt que de conclure.
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

  const elements = root.elements;
  if (Array.isArray(elements)) return elements.flatMap(collect);
  return collect(root);
}

/** Le nombre d'abonnés d'une page, ou `null` si la réponse n'en porte pas. */
export function followersFromNetworkSize(payload: unknown): number | null {
  const size = asRecord(payload)?.firstDegreeSize;
  return typeof size === "number" && Number.isFinite(size) ? size : null;
}

/**
 * Les compteurs cumulés d'une réponse de statistiques de publications.
 *
 * `null` quand la réponse ne porte aucun élément : une page qui n'a jamais
 * rien publié n'a pas de statistiques, et écrire six zéros dirait « aucune
 * impression ce mois-ci » là où il n'y a rien à mesurer.
 */
export function lifetimeFromShareStats(payload: unknown): LinkedinLifetimeTotals | null {
  const elements = asRecord(payload)?.elements;
  if (!Array.isArray(elements) || elements.length === 0) return null;

  const stats = asRecord(asRecord(elements[0])?.totalShareStatistics);
  if (!stats) return null;

  return {
    impressions: asNumber(stats.impressionCount),
    reach: asNumber(stats.uniqueImpressionsCount),
    clicks: asNumber(stats.clickCount),
    likes: asNumber(stats.likeCount),
    comments: asNumber(stats.commentCount),
    shares: asNumber(stats.shareCount),
  };
}

/**
 * Ce qui s'est passé entre deux relevés cumulés.
 *
 * Un compteur ne recule pas : une différence négative dit que LinkedIn a
 * corrigé son total, pas que le client a perdu des impressions. On la borne
 * à zéro plutôt que d'afficher un chiffre qui ne peut pas exister.
 *
 * Sans relevé antérieur, il n'y a **rien à dire** — et surtout pas le cumul
 * de toute l'histoire de la page présenté comme le mois écoulé.
 */
export function deltaBetween(
  previous: LinkedinLifetimeTotals | null,
  current: LinkedinLifetimeTotals | null,
): LinkedinLifetimeTotals | null {
  if (!current || !previous) return null;
  const keys = Object.keys(EMPTY_LIFETIME_TOTALS) as (keyof LinkedinLifetimeTotals)[];
  const delta = { ...EMPTY_LIFETIME_TOTALS };
  for (const key of keys) {
    delta[key] = Math.max(0, current[key] - previous[key]);
  }
  return delta;
}
