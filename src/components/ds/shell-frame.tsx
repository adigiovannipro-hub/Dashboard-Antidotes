"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";

import { signOut } from "@/app/actions/auth";
import { Sidebar } from "@/components/ds/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NavGroup } from "@/lib/navigation";

/**
 * Le cadre applicatif : rail à gauche, barre de page en haut, contenu au
 * centre.
 *
 * Client uniquement pour l'ouverture du tiroir mobile et l'état du repli.
 * Tout ce qui vient de la base — la navigation, l'identité, les actions de la
 * page — traverse en propriétés depuis un composant serveur.
 */
export function ShellFrame({
  groups,
  email,
  isOwner,
  openAccess,
  title,
  subtitle,
  actions,
  children,
}: {
  groups: NavGroup[];
  email: string;
  isOwner: boolean;
  openAccess: boolean;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const initial = (email[0] ?? "?").toUpperCase();

  return (
    <div className="flex min-h-dvh w-full">
      <Sidebar
        groups={groups}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-canvas/85 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[90rem] items-center gap-3 px-4 py-3.5 md:px-10">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir la navigation"
              className="hover:bg-muted focus-visible:ring-ring -ml-1 rounded-md p-2 text-text-secondary focus-visible:ring-2 focus-visible:outline-none md:hidden"
            >
              <Menu className="size-5" strokeWidth={1.75} aria-hidden />
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="text-h1 truncate text-text-primary">{title}</h1>
              {subtitle ? (
                <p className="text-caption mt-0.5 truncate text-text-secondary">
                  {subtitle}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {actions}

              {/* Un bandeau qu'on ne peut pas manquer : une application ouverte
                  qu'on croit fermée est bien plus dangereuse qu'une application
                  ouverte qu'on sait ouverte. */}
              {openAccess ? (
                <span
                  className="text-caption hidden rounded-pill border border-danger/40 px-2.5 py-1 font-medium text-danger-ink sm:inline"
                  title="Aucune authentification : toute personne ayant l'URL voit l'ensemble des espaces. Passer ANTIDOTES_OPEN_ACCESS à false pour refermer."
                >
                  Accès public
                </span>
              ) : null}

              <ThemeToggle />

              <DropdownMenu>
                <DropdownMenuTrigger
                  className="text-caption bg-surface-sunken hover:text-foreground focus-visible:ring-ring flex size-9 items-center justify-center rounded-pill border border-border font-medium text-text-secondary focus-visible:ring-2 focus-visible:outline-none"
                  aria-label="Menu du compte"
                >
                  {initial}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate font-normal">
                    <span className="text-caption block text-text-secondary">
                      Connecté en tant que
                    </span>
                    {email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isOwner ? (
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

        <main className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-6 md:px-10 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
