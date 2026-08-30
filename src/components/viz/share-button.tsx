"use client";

import { useTransition } from "react";
import { Share2 } from "lucide-react";
import { toast } from "sonner";

import { createShareLink } from "@/app/actions/partage";

/**
 * « Partager » : crée le lien public du rapport affiché et le met au
 * presse-papier. La période est figée au moment du partage — le rapport
 * envoyé ne bougera plus, même si l'écran d'origine change de mois.
 */
export function ShareButton({
  workspaceSlug,
  dashboardSlug,
  du,
  au,
}: {
  workspaceSlug: string;
  dashboardSlug: string;
  du: string;
  au: string;
}) {
  const [pending, start] = useTransition();

  const share = () => {
    start(async () => {
      const result = await createShareLink({
        workspace: workspaceSlug,
        dashboard: dashboardSlug,
        du,
        au,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      try {
        await navigator.clipboard.writeText(result.url);
        toast.success(result.message);
      } catch {
        // Presse-papier refusé (permission, contexte non sécurisé) : le lien
        // se donne quand même, en toast durable.
        toast.success(`Lien créé : ${result.url}`, { duration: 15000 });
      }
    });
  };

  return (
    <button
      type="button"
      onClick={share}
      disabled={pending}
      title="Créer un lien public de ce rapport et le copier"
      className="border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 focus-visible:ring-brand inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
    >
      <Share2 className="size-4" strokeWidth={1.75} aria-hidden />
      {pending ? "Création…" : "Partager"}
    </button>
  );
}
