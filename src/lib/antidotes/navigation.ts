/**
 * Les pages du pôle Antidotes — source unique du sous-menu du rail et des
 * onglets de la section, comme `listWorkspacePages()` l'est pour un espace
 * client : une page ajoutée demain apparaît aux deux endroits sans retouche,
 * et aucun onglet ne mène à un 404.
 *
 * Deux pôles, outbound et inbound, plus les case studies à la racine. Seul
 * le pipeline existe aujourd'hui ; les autres entrées rejoindront cette liste
 * avec leur page, jamais avant.
 *
 * Ni `"use client"` ni `server-only` : lu par la navigation serveur et par
 * les onglets client.
 */

export type AntidotesGroup = "outbound" | "inbound" | "root";

export type AntidotesPage = {
  /** Le segment de route, pour savoir quel onglet est actif. */
  key: string;
  group: AntidotesGroup;
  href: string;
  name: string;
};

export const ANTIDOTES_GROUP_LABELS: Record<AntidotesGroup, string> = {
  outbound: "Outbound",
  inbound: "Inbound",
  root: "",
};

export const ANTIDOTES_PAGES: AntidotesPage[] = [
  {
    key: "sourcing",
    group: "outbound",
    href: "/antidotes/outbound/sourcing",
    name: "Sourcing",
  },
  {
    key: "pipeline",
    group: "outbound",
    href: "/antidotes/outbound/pipeline",
    name: "Pipeline",
  },
];

/** La porte d'entrée du pôle : le pipeline — c'est là qu'on travaille. */
export const ANTIDOTES_HOME = "/antidotes/outbound/pipeline";

/** Le libellé complet d'une page, tel que le rail l'affiche : « Outbound · Pipeline ». */
export function antidotesPageLabel(page: AntidotesPage): string {
  const group = ANTIDOTES_GROUP_LABELS[page.group];
  return group ? `${group} · ${page.name}` : page.name;
}
