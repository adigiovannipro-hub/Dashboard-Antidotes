/**
 * Les pages du pôle Antidotes — source unique du sous-menu du rail et des
 * onglets de la section, comme `listWorkspacePages()` l'est pour un espace
 * client : une page ajoutée demain apparaît aux deux endroits sans retouche,
 * et aucun onglet ne mène à un 404.
 *
 * Deux versants, et c'est tout ce que le rail montre : **Outbound** — trois
 * pages, sourcing, pipeline, séquences, en onglets d'un cran plus bas — et
 * **Inbound**, une seule page à vues. Les case studies rejoindront cette
 * liste avec leur page, jamais avant.
 *
 * Ni `"use client"` ni `server-only` : lu par la navigation serveur et par
 * les onglets client.
 */

export type AntidotesSection = "outbound" | "inbound";

export type AntidotesSectionEntry = {
  key: AntidotesSection;
  href: string;
  name: string;
};

export const ANTIDOTES_SECTIONS: AntidotesSectionEntry[] = [
  { key: "outbound", href: "/antidotes/outbound", name: "Outbound" },
  { key: "inbound", href: "/antidotes/inbound", name: "Inbound" },
];

export type AntidotesPage = {
  /** Le segment de route, pour savoir quel onglet est actif. */
  key: string;
  section: AntidotesSection;
  href: string;
  name: string;
};

/** Les pages de l'outbound, dans l'ordre du parcours : sourcer, travailler, contacter. */
export const OUTBOUND_PAGES: AntidotesPage[] = [
  { key: "sourcing", section: "outbound", href: "/antidotes/outbound/sourcing", name: "Sourcing" },
  { key: "pipeline", section: "outbound", href: "/antidotes/outbound/pipeline", name: "Pipeline" },
  { key: "sequences", section: "outbound", href: "/antidotes/outbound/sequences", name: "Séquences" },
];

/** Toutes les pages à onglets ; l'inbound n'en a pas, sa page est unique. */
export const ANTIDOTES_PAGES: AntidotesPage[] = [...OUTBOUND_PAGES];

/** La porte d'entrée du pôle : le pipeline — c'est là qu'on travaille. */
export const ANTIDOTES_HOME = "/antidotes/outbound/pipeline";

/** La page unique de l'inbound. */
export const INBOUND_HOME = "/antidotes/inbound";

/** Le versant d'un chemin, ou rien hors du pôle. */
export function sectionOf(pathname: string): AntidotesSection | null {
  const entry = ANTIDOTES_SECTIONS.find(
    (section) => pathname === section.href || pathname.startsWith(`${section.href}/`),
  );
  return entry?.key ?? null;
}
