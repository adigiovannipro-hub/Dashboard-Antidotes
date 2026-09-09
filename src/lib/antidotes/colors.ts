import type { StatusTone } from "@/components/ds/status-pill";
import type { Contact, ProspectStatus } from "./types";

/**
 * Le code couleur du pipeline — pur, sans un hex.
 *
 * Trois porteurs de couleur, et pas un de plus : le point d'une campagne, le
 * drapeau d'un score, la pastille d'un statut. Le texte, lui, reste à l'encre
 * sur une surface claire ; la couleur n'y est jamais seule à dire quelque
 * chose, le nom et le chiffre sont toujours à côté.
 *
 * La rampe est celle de l'histogramme des sources du Reporting web
 * (`web-sources-view.tsx`) : mono-teinte, trois pas de vert autour du vert
 * de marque, déclarés en clair comme en sombre dans `globals.css`. Le repli
 * — pas de campagne, score faible — est le gris des axes.
 */

export const CAMPAIGN_RAMP: readonly string[] = [
  "var(--ordinal-1)",
  "var(--ordinal-2)",
  "var(--ordinal-3)",
];

export const NO_CAMPAIGN_COLOR = "var(--viz-axis)";

/**
 * La couleur d'une campagne, dérivée de son identifiant — donc la même sur
 * la carte, dans le tableau et dans la légende, sans colonne en base. Comme
 * `category-colors.ts` en Finance : la couleur suit l'entité, jamais son
 * rang. Trois teintes pour N campagnes, deux peuvent donc se ressembler ;
 * c'est la légende nommée de la barre de filtres qui tranche, pas le point.
 */
export function campaignColor(campaignId: string | null): string {
  if (!campaignId) return NO_CAMPAIGN_COLOR;
  return CAMPAIGN_RAMP[fnv1a(campaignId) % CAMPAIGN_RAMP.length]!;
}

/**
 * Le drapeau d'un score : plus il est foncé, plus le prospect vaut le coup.
 * Les seuils suivent les paliers du score (`scoring.ts`) — 50 est un prospect
 * joignable ou dans la taille, 70 cumule deux signaux, 90 les a presque tous.
 */
export function scoreTone(score: number): string {
  if (!Number.isFinite(score)) return NO_CAMPAIGN_COLOR;
  if (score >= 90) return CAMPAIGN_RAMP[2]!;
  if (score >= 70) return CAMPAIGN_RAMP[1]!;
  if (score >= 50) return CAMPAIGN_RAMP[0]!;
  return NO_CAMPAIGN_COLOR;
}

/**
 * Deux lettres pour l'avatar d'un contact : prénom + nom, sinon les deux
 * premières du seul nom connu, sinon celles de l'adresse. Vide quand on ne
 * sait rien — l'avatar montre alors une silhouette, pas « ?? ».
 */
export function initialsOf(
  contact: Pick<Contact, "first_name" | "last_name" | "email"> | null | undefined,
): string {
  if (!contact) return "";
  const first = letterOf(contact.first_name);
  const last = letterOf(contact.last_name);
  if (first && last) return `${first}${last}`;
  const single = (contact.first_name ?? contact.last_name ?? "").trim();
  if (single) return single.slice(0, 2).toUpperCase();
  const local = (contact.email ?? "").split("@")[0]?.replace(/[^\p{L}\p{N}]/gu, "") ?? "";
  return local.slice(0, 2).toUpperCase();
}

function letterOf(value: string | null): string {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "";
}

/**
 * Le ton d'une colonne du kanban. Sémantique, comme partout : ce qui avance
 * est planifié (`info`), une réponse attend un geste de ma part (`warning`),
 * un rendez-vous ou une signature est favorable, une perte est un échec, et
 * ce qui n'a pas encore de qualité reste neutre.
 */
export const PROSPECT_STATUS_TONES: Record<ProspectStatus, StatusTone> = {
  to_qualify: "neutral",
  qualified: "info",
  no_contact_found: "neutral",
  contacted: "info",
  replied: "warning",
  meeting: "positive",
  won: "positive",
  lost: "danger",
};

/** FNV-1a 32 bits — déterministe, sans dépendance, suffisant pour trois cases. */
function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}
