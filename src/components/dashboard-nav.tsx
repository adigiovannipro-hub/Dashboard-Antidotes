"use client";

import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";

import { cn } from "@/lib/utils";

export type NavChild = {
  /** Second segment de route — le slug du tableau. */
  slug: string;
  href: string;
  name: string;
};

export type NavItem = {
  /** Premier segment de route, pour savoir lequel est actif. */
  segment: string;
  href: string;
  name: string;
  /** Sous-entrées — les tableaux d'une section. */
  children?: NavChild[];
};

export type NavSection = {
  /** Intitulé de groupe. Omis, les entrées se posent sans titre. */
  label?: string;
  items: NavItem[];
};

/**
 * Rail de navigation d'un espace.
 *
 * Une seule colonne fixe à gauche, qui porte tout : les sections de l'espace
 * et leurs tableaux en sous-entrées. Les pages n'affichent plus leur propre
 * rangée d'onglets — deux navigations pour le même geste, c'est une de trop.
 */
export function DashboardNav({
  ariaLabel,
  sections,
}: {
  ariaLabel: string;
  sections: NavSection[];
}) {
  const segments = useSelectedLayoutSegments();
  const visible = sections.filter((section) => section.items.length > 0);

  if (visible.length === 0) return null;

  return (
    <nav
      aria-label={ariaLabel}
      className="border-border bg-background shrink-0 border-b p-3 md:sticky md:top-14 md:h-[calc(100dvh-3.5rem)] md:w-60 md:overflow-y-auto md:border-r md:border-b-0 md:p-4"
    >
      <div className="flex gap-4 overflow-x-auto md:flex-col md:gap-5 md:overflow-visible">
        {visible.map((section, index) => (
          <div key={section.label ?? index} className="shrink-0 md:shrink">
            {section.label ? (
              <p className="text-muted-foreground mb-1.5 px-3 text-[11px] font-medium tracking-wide uppercase">
                {section.label}
              </p>
            ) : null}
            <ul className="flex gap-1 md:flex-col">
              {section.items.map((item) => {
                const active = segments[0] === item.segment;
                return (
                  <li key={item.segment} className="shrink-0 md:shrink">
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "focus-visible:ring-ring relative block rounded-md px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
                        active
                          ? "bg-muted text-foreground font-medium"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      )}
                    >
                      {/* Le vert de la charte est une ponctuation : il marque
                          l'entrée active, il ne remplit jamais. */}
                      {active ? (
                        <span
                          aria-hidden
                          className="bg-brand absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full"
                        />
                      ) : null}
                      {item.name}
                    </Link>

                    {item.children && item.children.length > 0 && active ? (
                      <ul className="mt-0.5 hidden space-y-0.5 md:block">
                        {item.children.map((child) => {
                          const childActive = segments[1] === child.slug;
                          return (
                            <li key={child.slug}>
                              <Link
                                href={child.href}
                                aria-current={childActive ? "page" : undefined}
                                className={cn(
                                  "focus-visible:ring-ring block rounded-md py-1.5 pr-3 pl-6 text-[13px] transition-colors focus-visible:ring-2 focus-visible:outline-none",
                                  childActive
                                    ? "text-foreground font-medium"
                                    : "text-muted-foreground hover:text-foreground",
                                )}
                              >
                                {child.name}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
