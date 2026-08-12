"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

import {
  PillIndicator,
  useOptimisticPill,
  usePillIndicator,
} from "@/components/ds/pill-indicator";
import { LinkPending } from "@/components/ds/route-progress";
import { cn } from "@/lib/utils";

export type NavItem = {
  /** Premier segment de route, pour savoir lequel est actif. */
  segment: string;
  href: string;
  name: string;
};

/**
 * Les sections d'un espace client, en onglets.
 *
 * Horizontal et non plus vertical : depuis que le rail latéral porte la
 * navigation entre espaces, deux colonnes de liens se faisaient concurrence.
 * L'onglet actif se lit à l'encre pleine, comme les filtres — c'est une
 * sélection, pas un état favorable.
 *
 * L'aplat actif **glisse** d'un onglet à l'autre, et il part au clic, sans
 * attendre la page. C'est le passage le plus emprunté de l'application —
 * Contexte, Planning, Reporting d'un même client — et c'était le plus muet :
 * la page suivante est rendue par le serveur, donc l'écran restait rigoureu-
 * sement identique le temps de l'aller-retour. Voir `ds/pill-indicator.tsx`
 * pour le repli sans JavaScript, qui reste l'affichage d'avant.
 */
export function DashboardNav({
  workspaceName,
  items,
}: {
  workspaceName: string;
  items: NavItem[];
}) {
  const segment = useSelectedLayoutSegment();
  const { active, select } = useOptimisticPill(segment ?? "");
  const { listRef, box, measured } = usePillIndicator<HTMLUListElement>(active);

  if (items.length === 0) return null;

  return (
    <nav aria-label={`Sections de ${workspaceName}`}>
      <ul
        ref={listRef}
        className="relative inline-flex items-center gap-1 rounded-pill bg-surface-sunken p-1"
      >
        <PillIndicator box={box} />

        {items.map((item) => {
          const current = active === item.segment;
          return (
            <li key={item.segment} data-pill={item.segment}>
              <Link
                href={item.href}
                // `aria-current` suit la route réelle, pas le choix optimiste :
                // un lecteur d'écran ne doit pas annoncer une page où l'on
                // n'est pas encore.
                aria-current={segment === item.segment ? "page" : undefined}
                onClick={() => select(item.segment)}
                className={cn(
                  "type-caption focus-visible:ring-ring relative block rounded-pill px-3.5 py-1.5 font-medium transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
                  current
                    ? // Sans mesure — premier rendu, JavaScript absent — le
                      // fond reste sur le lien : l'écran d'avant, à l'identique.
                      cn("text-primary-foreground", !measured && "bg-primary")
                    : "text-text-secondary hover:text-text-primary",
                )}
              >
                <LinkPending />
                {item.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
