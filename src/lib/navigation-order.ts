/**
 * L'ordre du rail, tel qu'on l'a rangé à la souris.
 *
 * Ni `"use client"` ni `server-only` : la navigation serveur applique
 * l'ordre au premier rendu, et le rail client le recalcule au dépôt. La
 * clé d'une entrée est son `href` — stable, puisqu'un espace renommé garde
 * son slug.
 *
 * Une entrée absente de la liste mémorisée — un client créé hier — prend
 * place **après** celles qu'on a rangées, dans son ordre par défaut. On ne
 * devine pas où elle irait ; elle se range d'un glissement.
 */

/** Les deux groupes du rail que l'on peut ranger. */
export type RailGroupKey = "clients" | "entreprise";

export type RailOrder = Partial<Record<RailGroupKey, string[]>>;

/** Le titre du groupe dans le rail → sa clé dans `profiles.rail_order`. */
export const RAIL_GROUP_KEYS: Record<string, RailGroupKey> = {
  Clients: "clients",
  "Mon entreprise": "entreprise",
};

/** Relit ce que la base porte, sans rien supposer de sa forme. */
export function parseRailOrder(raw: unknown): RailOrder {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = (value: unknown): string[] | undefined =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : undefined;
  return {
    ...(list(source.clients) ? { clients: list(source.clients) } : {}),
    ...(list(source.entreprise) ? { entreprise: list(source.entreprise) } : {}),
  };
}

/** Range les entrées d'un groupe selon la liste mémorisée. */
export function orderEntries<T extends { href: string }>(
  entries: readonly T[],
  saved: readonly string[] | undefined,
): T[] {
  if (!saved || saved.length === 0) return [...entries];
  const rank = new Map(saved.map((href, index) => [href, index]));
  const known = entries.filter((entry) => rank.has(entry.href));
  const unknown = entries.filter((entry) => !rank.has(entry.href));
  known.sort((a, b) => rank.get(a.href)! - rank.get(b.href)!);
  return [...known, ...unknown];
}

/** Déplace une entrée d'une position à une autre — le geste du dépôt. */
export function moveEntry<T>(entries: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= entries.length || to >= entries.length) {
    return [...entries];
  }
  const next = [...entries];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

/**
 * La liste des `href` d'un groupe après un dépôt : l'entrée saisie prend la
 * place de celle sur laquelle on l'a lâchée. C'est ce qui part à la base —
 * pas des indices, qui ne survivraient pas à un client ajouté demain.
 *
 * Un dépôt sur soi-même ou sur une entrée inconnue rend la liste intacte,
 * sans rien enregistrer d'autre qu'une copie.
 */
export function reorderHrefs(
  hrefs: readonly string[],
  activeHref: string,
  overHref: string,
): string[] {
  const from = hrefs.indexOf(activeHref);
  const to = hrefs.indexOf(overHref);
  if (from === -1 || to === -1) return [...hrefs];
  return moveEntry(hrefs, from, to);
}

/**
 * L'ordre mémorisé, un groupe réécrit et l'autre conservé tel quel : ranger
 * les clients ne doit pas effacer ce qu'on avait rangé dans « Mon
 * entreprise ». Les doublons tombent — deux fois le même `href` donneraient
 * deux rangs à une seule ligne.
 */
export function mergeRailOrder(
  current: RailOrder,
  group: RailGroupKey,
  hrefs: readonly string[],
): RailOrder {
  return { ...current, [group]: [...new Set(hrefs)] };
}
