"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { addReportingNetwork } from "@/app/actions/context";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { safeAction } from "@/lib/context/safe-action";
import {
  REPORTING_NETWORK_LABELS,
  REPORTING_NETWORK_SUBTITLES,
  type ReportingNetwork,
} from "@/lib/reporting/networks";
import { cn } from "@/lib/utils";

/**
 * Le « + » de la barre d'onglets du Reporting : ouvrir une page de plus pour
 * ce client — Meta Ads, Instagram, Facebook ou Site Web.
 *
 * Ajouter une page, c'est **déclarer le réseau aux livrables du client** ;
 * l'onglet n'est que la lecture de cette déclaration. Le nouvel onglet
 * s'ouvre aussitôt avec son état vide, qui dit le branchement restant à
 * faire (affecter un compte, rattacher une propriété GA).
 *
 * Réservé au propriétaire : un client lit son rapport, il ne décide pas de
 * son périmètre. Sans réseau restant à proposer, le bouton disparaît.
 */
export function AddReportingPage({
  workspaceSlug,
  missing,
}: {
  workspaceSlug: string;
  /** Les réseaux que le Reporting sait servir et qui n'ont pas d'onglet. */
  missing: readonly ReportingNetwork[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (missing.length === 0) return null;

  const ajouter = (network: ReportingNetwork) => {
    start(async () => {
      const result = await safeAction(() =>
        addReportingNetwork({ workspace: workspaceSlug }, { reseau: network }),
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.message) toast.success(result.message);
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      {/* Déclencheur habillé par `buttonVariants`, jamais un `<Button>` passé
          en `render` — voir conversions-menu.tsx. */}
      <DropdownMenuTrigger
        disabled={pending}
        aria-label="Ajouter une page de reporting"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "text-text-secondary hover:text-text-primary shrink-0 px-2",
        )}
      >
        <Plus className="size-4" strokeWidth={1.75} aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-72 min-w-72">
        <div className="px-2 py-1.5">
          <p className="type-label text-text-primary">Ajouter une page</p>
          <p className="type-caption text-text-secondary mt-1">
            La page s&apos;ouvre tout de suite ; elle dira le branchement
            restant à faire.
          </p>
        </div>
        {missing.map((network) => (
          <DropdownMenuItem key={network} onClick={() => ajouter(network)}>
            <span className="flex flex-col gap-0.5">
              <span className="type-label">{REPORTING_NETWORK_LABELS[network]}</span>
              <span className="type-caption text-text-secondary">
                {REPORTING_NETWORK_SUBTITLES[network]}
              </span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
