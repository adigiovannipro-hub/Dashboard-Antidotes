import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * L'état vide, compact et actionnable.
 *
 * Deux principes, tirés de ce que faisaient les anciens blocs « Rien à
 * publier aujourd'hui » : ils occupaient la meilleure zone de l'écran pour ne
 * rien dire, et ils laissaient sans porte de sortie.
 *
 *   • hauteur réduite — un vide ne mérite pas la place d'un plein ;
 *   • une action toujours, jamais un cul-de-sac.
 *
 * Quand des données voisines existent — les publications des jours suivants
 * alors qu'aujourd'hui est vide — c'est `children` qui les porte, et le vide
 * n'est plus affiché du tout : voir l'appelant.
 */
export function EmptyState({
  icon: Icon,
  message,
  action,
  className,
}: {
  icon: LucideIcon;
  message: string;
  action?: { label: string; href: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border bg-surface-sunken px-5 py-4",
        className,
      )}
    >
      <Icon
        aria-hidden
        strokeWidth={1.75}
        className="size-5 shrink-0 text-text-tertiary"
      />
      <p className="type-body min-w-0 flex-1 text-text-secondary">{message}</p>
      {action ? (
        <Button render={<Link href={action.href} />} variant="outline" size="sm">
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
