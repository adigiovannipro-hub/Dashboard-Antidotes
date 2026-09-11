"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plug } from "lucide-react";
import { toast } from "sonner";

import { ConnexionsDialog } from "@/components/planning/connexions-dialog";
import { Button } from "@/components/ui/button";
import type { SocialAccountRow, SocialSelection } from "@/lib/social/types";

/**
 * Le branchement des comptes du client, ouvert depuis le Reporting.
 *
 * Il vivait dans l'en-tête du Planning, là où le besoin était de savoir *où
 * publier*. Mais c'est le Reporting qui rend un onglet vide quand aucun compte
 * n'est affecté, et c'est donc là qu'on cherche le geste : la boîte suit
 * l'endroit où le manque se voit.
 *
 * Réservé à l'agence — la boîte montre l'inventaire, qui porte le nom des
 * comptes des autres clients.
 */
export function ConnexionsButton({
  workspaceSlug,
  workspaceName,
  accounts,
  selection,
  networks,
  metaConfigured,
  retour,
}: {
  workspaceSlug: string;
  workspaceName: string;
  accounts: SocialAccountRow[];
  selection: SocialSelection;
  networks: string[];
  metaConfigured: boolean;
  /** Où l'aller-retour OAuth doit ramener : la page de reporting ouverte. */
  retour: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /* Le retour du branchement est un **événement d'arrivée** : il se lit une
     fois, au montage. L'URL est nettoyée juste après — recharger ne doit pas
     rejouer le message — et ce nettoyage ne doit pas refermer la boîte qu'il
     vient d'ouvrir, d'où la lecture à l'état initial plutôt qu'un effet. */
  const [retourBranchement] = useState(() => {
    const done = searchParams.get("connecte");
    if (done) return { ok: true, message: done };
    const failed = searchParams.get("erreur");
    if (failed) return { ok: false, message: failed };
    return null;
  });
  const [open, setOpen] = useState(retourBranchement !== null);

  useEffect(() => {
    if (!retourBranchement) return;
    if (retourBranchement.ok) toast.success(retourBranchement.message);
    else toast.error(retourBranchement.message);

    const next = new URLSearchParams(window.location.search);
    next.delete("connecte");
    next.delete("erreur");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [retourBranchement, pathname, router]);

  return (
    <>
      <Button
        size="icon-sm"
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label="Connexions"
        title="Choisir les comptes sur lesquels ce client publie"
      >
        <Plug strokeWidth={1.75} aria-hidden />
      </Button>

      <ConnexionsDialog
        workspaceSlug={workspaceSlug}
        workspaceName={workspaceName}
        accounts={accounts}
        selection={selection}
        networks={networks}
        metaConfigured={metaConfigured}
        retour={retour}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
