import "server-only";

import { cache } from "react";

import { getViewer } from "@/lib/auth";
import { getModerationContext } from "@/lib/moderation/access";
import { isModerationVisible } from "@/lib/moderation/permissions";

/**
 * Le modèle de navigation du rail latéral.
 *
 * Calculé une fois par requête et partagé par tous les layouts : le rail est
 * le même partout, c'est ce qui en fait un repère. Il ne contient que des
 * données sérialisables — le composant qui l'affiche est un composant client,
 * il ne peut pas recevoir de fonction ni de composant.
 *
 * Le filtrage suit la règle des modules internes : ce à quoi le visiteur n'a
 * pas droit n'apparaît pas, plutôt que d'apparaître désactivé. Un client ne
 * doit pas apprendre l'existence de la Modération en voyant une entrée grisée.
 */

/** Icône à afficher, résolue en composant côté client. */
export type NavIcon =
  | "aujourdhui"
  | "client"
  | "entreprise"
  | "perso"
  | "moderation"
  | "finance"
  | "recus"
  | "acces";

export type NavEntry = {
  href: string;
  label: string;
  icon: NavIcon;
  /** Pastille de couleur de l'espace, quand il en porte une. */
  accent?: string | null;
  /** Correspondance de chemin : `exact` pour l'accueil, sinon par préfixe. */
  match: "exact" | "prefix";
};

export type NavGroup = { title: string; entries: NavEntry[] };

export const getAppNavigation = cache(async (): Promise<NavGroup[]> => {
  const viewer = await getViewer();
  if (!viewer) return [];

  const moderation = await getModerationContext();

  const workspacesOfType = (type: "client" | "business" | "personal") =>
    viewer.workspaces
      .filter((workspace) => workspace.type === type)
      .map(
        (workspace): NavEntry => ({
          href: `/espace/${workspace.slug}`,
          label: workspace.name,
          icon: type === "client" ? "client" : type === "business" ? "entreprise" : "perso",
          accent: workspace.accent_color,
          match: "prefix",
        }),
      );

  const groups: NavGroup[] = [
    {
      title: "Aujourd'hui",
      entries: [
        { href: "/", label: "Mon travail", icon: "aujourdhui", match: "exact" },
      ],
    },
    { title: "Clients", entries: workspacesOfType("client") },
    {
      title: "Mon entreprise",
      entries: [
        ...workspacesOfType("business"),
        ...(viewer.isOwner
          ? ([
              {
                href: "/entreprise/finance",
                label: "Finance",
                icon: "finance",
                match: "prefix",
              },
              {
                href: "/entreprise/recus",
                label: "Reçus",
                icon: "recus",
                match: "prefix",
              },
            ] satisfies NavEntry[])
          : []),
      ],
    },
    { title: "Perso", entries: workspacesOfType("personal") },
    {
      title: "Outils internes",
      entries: [
        ...(isModerationVisible(moderation.access)
          ? ([
              {
                href: "/moderation",
                label: "Modération",
                icon: "moderation",
                match: "prefix",
              },
            ] satisfies NavEntry[])
          : []),
        ...(viewer.isOwner
          ? ([
              {
                href: "/admin/acces",
                label: "Gestion des accès",
                icon: "acces",
                match: "prefix",
              },
            ] satisfies NavEntry[])
          : []),
      ],
    },
  ];

  return groups.filter((group) => group.entries.length > 0);
});
