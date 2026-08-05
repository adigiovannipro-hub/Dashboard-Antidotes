import { AppHeader } from "@/components/app-header";
import { EntrepriseNav } from "@/components/entreprise-nav";
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

  return (
    <>
      <AppHeader viewer={viewer} />

      <div className="flex flex-1 flex-col md:flex-row">
        <nav
          aria-label="Mon entreprise"
          className="border-border shrink-0 border-b p-3 md:w-56 md:border-r md:border-b-0 md:p-4"
        >
          <p className="text-muted-foreground mb-2 px-3 text-xs font-medium tracking-wide uppercase">
            Mon entreprise
          </p>
          <EntrepriseNav />
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </>
  );
}
