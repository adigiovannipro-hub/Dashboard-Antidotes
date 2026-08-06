import { AppShell } from "@/components/ds/app-shell";
import { requireViewer } from "@/lib/auth";
import { requireFinanceAccess } from "@/lib/finance/access";

/**
 * Espace « Mon Entreprise ».
 *
 * Distinct de `/espace/[workspace]`, qui sert les dashboards de reporting : ce
 * qui vit ici est opérationnel — on y agit, on n'y consulte pas. La même
 * distinction que celle qui a mis la Modération sur sa propre route.
 *
 * L'accès est vérifié dans le layout : les pages n'ont pas à le refaire, et
 * aucune sous-route ne peut être ajoutée en oubliant le contrôle. La garde du
 * module Finance est celle de toute la section — être owner de l'organisation.
 * Chaque module raffine ensuite ce dont il a besoin (Reçus recharge ses
 * boîtes, par exemple).
 */
export default async function EntrepriseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await requireViewer();
  await requireFinanceAccess();

  // Le rail latéral porte désormais Finance et Reçus : le second rail de
  // section qui vivait ici faisait doublon, chaque écran ayant deux
  // navigations verticales côte à côte.
  return (
    <AppShell viewer={viewer} title="Mon entreprise">
      {children}
    </AppShell>
  );
}
