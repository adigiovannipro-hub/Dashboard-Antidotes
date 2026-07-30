"use client";

import Link from "next/link";
import { Check, ChevronsUpDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { WorkspaceAccess } from "@/lib/auth";
import type { WorkspaceType } from "@/lib/supabase/database.types";

const GROUP_LABELS: Record<WorkspaceType, string> = {
  client: "Clients",
  business: "Mon entreprise",
  personal: "Perso",
};

const GROUP_ORDER: WorkspaceType[] = ["client", "business", "personal"];

export function WorkspaceSwitcher({
  workspaces,
  currentSlug,
}: {
  workspaces: WorkspaceAccess[];
  currentSlug?: string;
}) {
  const current = workspaces.find((workspace) => workspace.slug === currentSlug);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="hover:bg-muted focus-visible:ring-ring flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none">
        {current ? (
          <>
            <span
              aria-hidden
              className="bg-muted-foreground/30 size-2 rounded-full"
              style={
                current.accent_color
                  ? { backgroundColor: current.accent_color }
                  : undefined
              }
            />
            {current.name}
          </>
        ) : (
          <span className="text-muted-foreground">Tous les espaces</span>
        )}
        <ChevronsUpDown className="text-muted-foreground size-3.5" aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuItem render={<Link href="/" />}>
          Tous les espaces
        </DropdownMenuItem>

        {GROUP_ORDER.map((type) => {
          const group = workspaces.filter((workspace) => workspace.type === type);
          if (group.length === 0) return null;

          return (
            <div key={type}>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
                {GROUP_LABELS[type]}
              </DropdownMenuLabel>
              {group.map((workspace) => (
                <DropdownMenuItem
                  key={workspace.id}
                  render={<Link href={`/espace/${workspace.slug}`} />}
                >
                  <span
                    aria-hidden
                    className="bg-muted-foreground/30 size-2 rounded-full"
                    style={
                      workspace.accent_color
                        ? { backgroundColor: workspace.accent_color }
                        : undefined
                    }
                  />
                  <span className="flex-1 truncate">{workspace.name}</span>
                  {workspace.slug === currentSlug ? (
                    <Check className="size-3.5" aria-hidden />
                  ) : null}
                </DropdownMenuItem>
              ))}
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
