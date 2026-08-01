import Link from "next/link";

import { AppHeader } from "@/components/app-header";
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
        <nav
          aria-label="Mon entreprise"
          className="border-border shrink-0 border-b p-3 md:w-56 md:border-r md:border-b-0 md:p-4"
        >
          <p className="text-muted-foreground mb-2 px-3 text-xs font-medium tracking-wide uppercase">
            Mon entreprise
          </p>
          <ul className="flex gap-1 md:flex-col">
            <li>
              <Link
                href="/entreprise/recus"
                aria-current="page"
                className="bg-muted text-foreground focus-visible:ring-ring block rounded-md px-3 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
              >
                Reçus
              </Link>
            </li>
          </ul>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </>
  );
}
