import type { InboxSelection } from "./counters";
import { CHANNEL_LABELS, type ModerationChannel, type StatusGroup } from "./types";

/**
 * Les filtres de l'Inbox, lus de l'URL — une seule fois, au même endroit.
 *
 * La page et « Tout lire » lisaient chacune les paramètres à leur façon, et le
 * bouton pouvait donc marquer autre chose que ce que l'écran montrait. Ils
 * passent désormais par cette fonction, qui est aussi la seule à connaître les
 * valeurs par défaut.
 *
 * Tout est en français dans l'URL, comme partout : `?reseau=`, `?client=`,
 * `?statut=`, `?nonlus=`, `?signalees=`, `?mp=`, `?q=`.
 */

export type SegmentGroup = StatusGroup;

export const SEGMENT_ORDER: SegmentGroup[] = ["a-traiter", "en-attente", "traitees"];

export const SEGMENT_LABELS: Record<SegmentGroup, string> = {
  "a-traiter": "À traiter",
  "en-attente": "En attente",
  traitees: "Traitées",
};

/**
 * Le segment d'ouverture. « Toutes » a disparu : un quatrième onglet qui
 * contient les trois autres n'est pas un filtre, c'est leur absence — et
 * l'écran s'ouvrait alors sur des centaines de fils classés, où le travail du
 * jour se noyait.
 */
export const DEFAULT_SEGMENT: SegmentGroup = "a-traiter";

export function isSegment(value: string): value is SegmentGroup {
  return (SEGMENT_ORDER as string[]).includes(value);
}

function isChannel(value: string): value is ModerationChannel {
  return value in CHANNEL_LABELS;
}

/** `?reseau=instagram,facebook` — plusieurs réseaux cochés, dans l'ordre lu. */
export function parseNetworks(raw: string | undefined): ModerationChannel[] {
  if (!raw) return [];
  const seen = new Set<ModerationChannel>();
  for (const part of raw.split(",")) {
    const value = part.trim();
    if (isChannel(value)) seen.add(value);
  }
  return [...seen];
}

export function serializeNetworks(networks: readonly ModerationChannel[]): string | null {
  return networks.length > 0 ? networks.join(",") : null;
}

/** Coche ou décoche un réseau, sans jamais dupliquer ni réordonner le reste. */
export function toggleNetwork(
  networks: readonly ModerationChannel[],
  channel: ModerationChannel,
): ModerationChannel[] {
  return networks.includes(channel)
    ? networks.filter((candidate) => candidate !== channel)
    : [...networks, channel];
}

export type InboxQuery = {
  reseau?: string;
  statut?: string;
  nonlus?: string;
  signalees?: string;
  mp?: string;
  q?: string;
};

/**
 * L'URL vers la sélection. Le client est résolu par l'appelant : le slug de
 * l'URL ne devient un identifiant qu'après vérification d'accès.
 */
export function parseInboxSelection(
  query: InboxQuery,
  clientId?: string,
): InboxSelection {
  return {
    networks: parseNetworks(query.reseau),
    clientId,
    statusGroup:
      query.statut && isSegment(query.statut) ? query.statut : DEFAULT_SEGMENT,
    unreadOnly: query.nonlus === "1",
    flaggedOnly: query.signalees === "1",
    dmOnly: query.mp === "1",
  };
}
