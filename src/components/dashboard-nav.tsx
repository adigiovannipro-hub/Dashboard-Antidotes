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
    <nav
      aria-label={`Sections de ${workspaceName}`}
      className="border-border shrink-0 border-b p-3 md:w-56 md:border-r md:border-b-0 md:p-4"
    >
      <ul className="flex gap-1 md:flex-col">
        {items.map((item) => {
          const active = segment === item.segment;
          return (
            <li key={item.segment}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring block rounded-md px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  active
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
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
