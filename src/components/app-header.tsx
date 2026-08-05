import Link from "next/link";

import { signOut } from "@/app/actions/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { Wordmark } from "@/components/wordmark";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isOpenAccess } from "@/lib/access-mode";
import type { Viewer } from "@/lib/auth";

export function AppHeader({
  viewer,
  currentWorkspaceSlug,
}: {
  viewer: Viewer;
  currentWorkspaceSlug?: string;
}) {
  const initial = (viewer.email[0] ?? "?").toUpperCase();

  return (
    <header className="border-border bg-background/80 sticky top-0 z-30 border-b backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4 md:px-6">
        <Link href="/" className="focus-visible:ring-ring rounded focus-visible:ring-2 focus-visible:outline-none">
          <Wordmark />
        </Link>

        {viewer.workspaces.length > 1 ? (
          <>
            <span aria-hidden className="text-muted-foreground/40 text-lg">
              /
            </span>
            <WorkspaceSwitcher
              workspaces={viewer.workspaces}
              currentSlug={currentWorkspaceSlug}
            />
          </>
        ) : null}

        <div className="ml-auto flex items-center gap-1">
          {/* Un bandeau qu'on ne peut pas manquer : une application ouverte
              qu'on croit fermée est bien plus dangereuse qu'une application
              ouverte qu'on sait ouverte. */}
          {isOpenAccess() ? (
            <span
              className="border-brand-red/40 text-brand-red mr-2 rounded-full border px-2 py-0.5 text-[11px] font-medium"
              title="Aucune authentification : toute personne ayant l'URL voit l'ensemble des espaces. Retirer ANTIDOTES_OPEN_ACCESS pour refermer."
            >
              Accès public
            </span>
          ) : null}

          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger
              className="bg-muted text-muted-foreground hover:text-foreground focus-visible:ring-ring flex size-8 items-center justify-center rounded-full text-xs font-medium focus-visible:ring-2 focus-visible:outline-none"
              aria-label="Menu du compte"
            >
              {initial}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate font-normal">
                <span className="text-muted-foreground block text-xs">
                  Connecté en tant que
                </span>
                {viewer.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {viewer.isOwner ? (
                <DropdownMenuItem render={<Link href="/admin/acces" />}>
                  Gestion des accès
                </DropdownMenuItem>
              ) : null}
              <form action={signOut}>
                <DropdownMenuItem
                  render={<button type="submit" className="w-full text-left" />}
                >
                  Se déconnecter
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
