"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

import { cn } from "@/lib/utils";

export function DashboardNav({
  workspaceSlug,
  workspaceName,
  dashboards,
}: {
  workspaceSlug: string;
  workspaceName: string;
  dashboards: { slug: string; name: string }[];
}) {
  const segment = useSelectedLayoutSegment();

  if (dashboards.length === 0) return null;

  return (
    <nav
      aria-label={`Dashboards de ${workspaceName}`}
      className="border-border shrink-0 border-b p-3 md:w-56 md:border-r md:border-b-0 md:p-4"
    >
      <ul className="flex gap-1 md:flex-col">
        {dashboards.map((dashboard) => {
          const active = segment === dashboard.slug;
          return (
            <li key={dashboard.slug}>
              <Link
                href={`/espace/${workspaceSlug}/${dashboard.slug}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring block rounded-md px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  active
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {dashboard.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
