"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

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
 */
export function DashboardNav({
  workspaceName,
  items,
}: {
  workspaceName: string;
  items: NavItem[];
}) {
  const segment = useSelectedLayoutSegment();

  if (items.length === 0) return null;

  return (
    <nav aria-label={`Sections de ${workspaceName}`}>
      <ul className="inline-flex items-center gap-1 rounded-pill bg-surface-sunken p-1">
        {items.map((item) => {
          const active = segment === item.segment;
          return (
            <li key={item.segment}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "type-caption focus-visible:ring-ring block rounded-pill px-3.5 py-1.5 font-medium transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-text-secondary hover:text-text-primary",
                )}
              >
                {item.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
