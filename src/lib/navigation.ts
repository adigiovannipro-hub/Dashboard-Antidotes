import "server-only";

import { cache } from "react";

import { getViewer } from "@/lib/auth";
import { getModerationContext } from "@/lib/moderation/access";
import { isModerationVisible } from "@/lib/moderation/permissions";
import { getNavBadges } from "@/lib/mon-travail/badges";

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
  | "echeances"
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
  /**
   * Nombre en attente, affiché en pastille à droite du libellé.
   *
   * `undefined` quand l'entrée ne compte rien ; **zéro ne s'affiche pas** — une
   * pastille « 0 » occupe la place d'une alerte pour dire qu'il n'y en a pas.
   */
  badge?: number;
};

export type NavGroup = { title: string; entries: NavEntry[] };

export const getAppNavigation = cache(async (): Promise<NavGroup[]> => {
  const viewer = await getViewer();
  if (!viewer) return [];

  const [moderation, badges] = await Promise.all([
    getModerationContext(),
    getNavBadges(),
  ]);

  // Plus de `"personal"` : le rail ne porte plus de section Perso, et laisser
  // le cas ouvert aurait gardé une branche que rien n'emprunte.
  const workspacesOfType = (type: "client" | "business") =>
    viewer.workspaces
      .filter((workspace) => workspace.type === type)
      .map(
        (workspace): NavEntry => ({
          href: `/espace/${workspace.slug}`,
          label: workspace.name,
          icon: type === "client" ? "client" : "entreprise",
          accent: workspace.accent_color,
          match: "prefix",
        }),
      );

  const groups: NavGroup[] = [
    {
      // La Modération monte juste sous « Mon travail » : c'est le deuxième
      // geste de la journée, pas un outil qu'on va chercher en bas du rail.
      title: "Aujourd'hui",
      entries: [
        {
          href: "/",
          label: "Mon travail",
          icon: "aujourdhui",
          match: "exact",
          badge: badges.travail,
        },
        ...(isModerationVisible(moderation.access)
          ? ([
              {
                href: "/moderation",
                label: "Modération",
                icon: "moderation",
                match: "prefix",
                badge: badges.moderation ?? undefined,
              },
            ] satisfies NavEntry[])
          : []),
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
                href: "/entreprise/echeances",
                label: "Échéances",
                icon: "echeances",
                match: "prefix",
              },
            ] satisfies NavEntry[])
          : []),
      ],
    },
    // Plus de section « Perso » ni « Outils internes ». La première n'avait
    // qu'une entrée ; la seconde a vu la Modération remonter et la Gestion des
    // accès rejoindre le menu du compte, en haut à droite — un réglage de
    // compte se cherche là, pas dans une navigation de travail.
  ];

  return groups.filter((group) => group.entries.length > 0);
});
