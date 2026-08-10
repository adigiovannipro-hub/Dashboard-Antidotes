import { cookies } from "next/headers";

import { ShellFrame } from "@/components/ds/shell-frame";
import { isOpenAccess } from "@/lib/access-mode";
import type { Viewer } from "@/lib/auth";
import { getAppNavigation } from "@/lib/navigation";
import { RAIL_COOKIE } from "@/lib/ui-preferences";

/**
 * Enveloppe de tout écran applicatif : rail, barre de page, conteneur.
 *
 * Remplace `AppHeader`, qui ne portait que la barre du haut et laissait
 * chaque page réinventer sa mise en page. Le titre est passé par le layout
 * qui connaît la section — c'est lui qui sait s'il sert un espace client, la
 * Modération ou la comptabilité.
 */
export async function AppShell({
  viewer,
  title,
  subtitle,
  actions,
  wide,
  children,
}: {
  viewer: Viewer;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  /** Pleine largeur, pour les écrans en tableau — le planning éditorial. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  const [groups, cookieStore] = await Promise.all([getAppNavigation(), cookies()]);

  return (
    <ShellFrame
      groups={groups}
      email={viewer.email}
      isOwner={viewer.isOwner}
      openAccess={isOpenAccess()}
      title={title}
      subtitle={subtitle}
      actions={actions}
      wide={wide}
      // Le repli est rendu juste dès le serveur : pas de rail qui se replie
      // après coup, et aucun libellé tronqué en attendant l'hydratation.
      railCollapsed={cookieStore.get(RAIL_COOKIE)?.value === "1"}
    >
      {children}
    </ShellFrame>
  );
}
