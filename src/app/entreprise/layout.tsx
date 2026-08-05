import { AppHeader } from "@/components/app-header";
import { DashboardNav } from "@/components/dashboard-nav";
import { requireViewer } from "@/lib/auth";
import { requireReceiptsAccess } from "@/lib/recus/access";

/**
 * Espace « Mon Entreprise ».
 *
 * Distinct de `/espace/[workspace]`, qui sert les dashboards de reporting : ce
 * qui vit ici est opérationnel — on y agit, on n'y consulte pas. La même
 * distinction que celle qui a mis la Modération sur sa propre route.
 *
 * L'accès est vérifié dans le layout : les pages n'ont pas à le refaire, et
 * aucune sous-route ne peut être ajoutée en oubliant le contrôle.
 */
export default async function EntrepriseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await requireViewer();
  await requireReceiptsAccess();

  return (
    <>
      <AppHeader viewer={viewer} />

      <div className="flex flex-1 flex-col md:flex-row">
        <DashboardNav
          ariaLabel="Mon entreprise"
          sections={[
            {
              label: "Mon entreprise",
              items: [
                { segment: "recus", href: "/entreprise/recus", name: "Reçus" },
              ],
            },
          ]}
        />

        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </>
  );
}
