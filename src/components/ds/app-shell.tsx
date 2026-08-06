import { ShellFrame } from "@/components/ds/shell-frame";
import { isOpenAccess } from "@/lib/access-mode";
import type { Viewer } from "@/lib/auth";
import { getAppNavigation } from "@/lib/navigation";

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
  children,
}: {
  viewer: Viewer;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const groups = await getAppNavigation();

  return (
    <ShellFrame
      groups={groups}
      email={viewer.email}
      isOwner={viewer.isOwner}
      openAccess={isOpenAccess()}
      title={title}
      subtitle={subtitle}
      actions={actions}
    >
      {children}
    </ShellFrame>
  );
}
