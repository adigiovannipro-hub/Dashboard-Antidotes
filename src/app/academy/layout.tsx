import { AppShell } from "@/components/ds/app-shell";
import { requireAcademyAccess } from "@/lib/academy/access";
import { requireViewer } from "@/lib/auth";

/**
 * Section Academy — la formation interne, type Skool.
 *
 * L'accès est vérifié dans le layout : les pages n'ont pas à le refaire, et
 * aucune sous-route ne peut être ajoutée en oubliant le contrôle. La garde
 * répond 404 à qui n'est pas membre de l'organisation — un client d'espace
 * n'apprend pas l'existence du module.
 */
export default async function AcademyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await requireViewer();
  await requireAcademyAccess();

  return (
    <AppShell
      viewer={viewer}
      title="Academy"
      subtitle="Devenir freelance social media manager"
    >
      {children}
    </AppShell>
  );
}
