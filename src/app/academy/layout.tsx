import { AppShell } from "@/components/ds/app-shell";
import { requireAcademyAccess } from "@/lib/academy/access";
import { requireViewer } from "@/lib/auth";

/**
 * Section Academy — les formations, type Skool.
 *
 * L'accès est vérifié dans le layout : les pages n'ont pas à le refaire, et
 * aucune sous-route ne peut être ajoutée en oubliant le contrôle. La garde
 * répond 404 à qui n'est ni membre de l'organisation ni inscrit à une
 * formation — un client d'espace n'apprend pas l'existence du module.
 *
 * Plus de sous-titre : il nommait « Devenir freelance social media manager »
 * sur toutes les pages, y compris celles d'une autre formation.
 */
export default async function AcademyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await requireViewer();
  await requireAcademyAccess();

  return (
    <AppShell viewer={viewer} title="Academy">
      {children}
    </AppShell>
  );
}
