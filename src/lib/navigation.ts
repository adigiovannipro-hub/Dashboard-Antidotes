import "server-only";

import { cache } from "react";

import { getAcademyContext } from "@/lib/academy/access";
import { ANTIDOTES_PAGES, antidotesPageLabel } from "@/lib/antidotes/navigation";
import { getViewer } from "@/lib/auth";
import { getModerationContext } from "@/lib/moderation/access";
import { isModerationVisible } from "@/lib/moderation/permissions";
import { getNavBadges } from "@/lib/mon-travail/badges";
import { signLogoUrls } from "@/lib/workspaces/logos";
import {
  listHiddenPagesByWorkspace,
  listPagesByWorkspace,
} from "@/lib/workspaces/queries";

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
  | "factures"
  | "recus"
  | "acces"
  | "academy"
  | "antidotes";

export type NavEntry = {
  href: string;
  label: string;
  icon: NavIcon;
  /** Pastille de couleur de l'espace, quand il en porte une. */
  accent?: string | null;
  /** Logo signé de l'espace : il remplace la pastille de couleur. */
  logo?: string | null;
  /** Correspondance de chemin : `exact` pour l'accueil, sinon par préfixe. */
  match: "exact" | "prefix";
  /**
   * Nombre en attente, affiché en pastille à droite du libellé.
   *
   * `undefined` quand l'entrée ne compte rien ; **zéro ne s'affiche pas** — une
   * pastille « 0 » occupe la place d'une alerte pour dire qu'il n'y en a pas.
   */
  badge?: number;
  /**
   * Espace administrable depuis le rail : renommer, dupliquer, régler les
   * droits d'un partenaire, supprimer. Absent pour qui n'en est pas owner —
   * l'entrée reste alors un simple lien.
   */
  manage?: { slug: string; name: string };
  /**
   * Les pages de l'espace, pour le sous-menu au survol. Construites de la
   * même source que les onglets de l'espace (`listWorkspacePages` + Contexte
   * hors client) : une page ajoutée demain apparaît ici sans retouche.
   */
  children?: { href: string; label: string }[];
};

export type NavGroup = { title: string; entries: NavEntry[] };

export const getAppNavigation = cache(async (): Promise<NavGroup[]> => {
  const viewer = await getViewer();
  if (!viewer) return [];

  // Une élève de l'Academy n'a qu'une entrée, et c'est délibérément un
  // cul-de-sac : ni « Mon travail », ni Modération, ni Finance, ni espace
  // client. Le rail est la carte de ce à quoi on a droit — le sien tient en
  // une ligne, et rien d'autre ne doit s'y glisser par une branche oubliée.
  if (viewer.isStudent) {
    return [
      {
        title: "Formation",
        entries: [
          { href: "/academy", label: "Mes formations", icon: "academy", match: "prefix" },
        ],
      },
    ];
  }

  const [moderation, badges, academy] = await Promise.all([
    getModerationContext(),
    getNavBadges(),
    getAcademyContext(),
  ]);

  // Plus de `"personal"` : le rail ne porte plus de section Perso, et laisser
  // le cas ouvert aurait gardé une branche que rien n'emprunte.
  const spaceIds = viewer.workspaces
    .filter((workspace) => workspace.type !== "personal")
    .map((workspace) => workspace.id);
  const nonOwnerIds = viewer.workspaces
    .filter((workspace) => workspace.type !== "personal" && workspace.role !== "owner")
    .map((workspace) => workspace.id);

  const [logos, pagesByWorkspace, hiddenByWorkspace] = await Promise.all([
    signLogoUrls(viewer.workspaces.map((w) => w.logo_url)),
    listPagesByWorkspace(spaceIds),
    listHiddenPagesByWorkspace(nonOwnerIds, viewer.email),
  ]);

  const workspacesOfType = (type: "client" | "business") =>
    viewer.workspaces
      .filter((workspace) => workspace.type === type)
      .map((workspace): NavEntry => {
        const hidden = hiddenByWorkspace.get(workspace.id) ?? new Set<string>();
        const children = [
          // Même règle que les onglets de l'espace : le Contexte n'existe pas
          // pour un client, il est rendu aux autres rôles.
          ...(workspace.role !== "client"
            ? [{ href: `/espace/${workspace.slug}/contexte`, label: "Contexte" }]
            : []),
          ...(pagesByWorkspace.get(workspace.id) ?? [])
            .filter((page) => !hidden.has(page.key))
            .map((page) => ({
              href: `/espace/${workspace.slug}/${page.key}`,
              label: page.name,
            })),
        ];

        return {
          href: `/espace/${workspace.slug}`,
          label: workspace.name,
          icon: type === "client" ? "client" : "entreprise",
          accent: workspace.accent_color,
          logo: workspace.logo_url ? (logos.get(workspace.logo_url) ?? null) : null,
          match: "prefix",
          manage:
            workspace.role === "owner"
              ? { slug: workspace.slug, name: workspace.name }
              : undefined,
          children: children.length > 0 ? children : undefined,
        };
      });

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
                href: "/entreprise/factures",
                label: "Factures",
                icon: "factures",
                match: "prefix",
              },
              // Le pôle de développement commercial de l'agence : outbound
              // (sourcing, pipeline, séquences) et inbound (radar, studio).
              // Owner seulement, comme Finance — la prospection de l'agence
              // n'existe pour personne d'autre. Ses pages viennent de la même
              // liste que ses onglets : voir `lib/antidotes/navigation.ts`.
              {
                href: "/antidotes",
                label: "Antidotes",
                icon: "antidotes",
                match: "prefix",
                children: ANTIDOTES_PAGES.map((page) => ({
                  href: page.href,
                  label: antidotesPageLabel(page),
                })),
              },
            ] satisfies NavEntry[])
          : []),
        // L'Academy s'ouvre à tout membre de l'organisation, pas au seul
        // owner : c'est une formation d'équipe. Un client d'espace n'a pas
        // l'entrée — même règle que la Modération, il n'apprend pas
        // l'existence du module par le rail.
        ...(academy
          ? ([
              {
                href: "/academy",
                label: "Academy",
                icon: "academy",
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
