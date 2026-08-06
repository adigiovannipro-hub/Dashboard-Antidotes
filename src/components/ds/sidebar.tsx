"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  KeyRound,
  Lock,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Sun,
  Users,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Wordmark } from "@/components/wordmark";
import type { NavEntry, NavGroup, NavIcon } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/**
 * Le rail de navigation, présent sur tous les écrans applicatifs.
 *
 * Il remplace le hub comme point de passage obligé : jusqu'ici, aller de la
 * Finance au planning d'un client demandait un aller-retour par l'accueil.
 *
 * Repliable vers un rail d'icônes de 64 px, choix mémorisé dans le
 * navigateur. Le repli est lu **après** l'hydratation et non pendant le rendu
 * serveur, qui n'a pas accès au stockage local : appliquer l'état trop tôt
 * ferait diverger les deux rendus. La transition est neutralisée au premier
 * peint pour que la restitution du repli ne s'anime pas.
 */

const STORAGE_KEY = "antidotes:rail-replie";
const CHANGE_EVENT = "antidotes:rail-change";

/**
 * Le repli, lu là où il est vraiment : sur le document.
 *
 * `useSyncExternalStore` plutôt qu'un `useState` synchronisé dans un effet —
 * l'état ne vit pas dans React, il vit dans le stockage local et dans un
 * attribut posé par le script d'amorçage. Le lire ainsi évite le rendu en
 * cascade qu'un `setState` dans un effet provoquerait à chaque montage.
 */
function subscribeToRail(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  // Un second onglet qui replie son rail replie aussi celui-ci.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readRail(): boolean {
  return document.documentElement.dataset.railReplie === "1";
}

/** Le serveur ne connaît pas le choix : il rend le rail déplié. */
function readRailOnServer(): boolean {
  return false;
}

function setRail(collapsed: boolean) {
  document.documentElement.dataset.railReplie = collapsed ? "1" : "0";
  try {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    // Navigation privée, stockage refusé : le repli vaut pour cette session.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

const ICONS: Record<NavIcon, LucideIcon> = {
  aujourdhui: Sun,
  client: Users,
  entreprise: Briefcase,
  perso: Lock,
  moderation: MessagesSquare,
  finance: Wallet,
  recus: Receipt,
  acces: KeyRound,
};

function isActive(entry: NavEntry, pathname: string): boolean {
  if (entry.match === "exact") return pathname === entry.href;
  return pathname === entry.href || pathname.startsWith(`${entry.href}/`);
}

export function Sidebar({
  groups,
  mobileOpen,
  onCloseMobile,
}: {
  groups: NavGroup[];
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(
    subscribeToRail,
    readRail,
    readRailOnServer,
  );

  return (
    <>
      {/* Voile du tiroir mobile. Le rail est un panneau plein écran en dessous
          de `md`, où 240 px de largeur fixe prendraient la moitié de l'écran. */}
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Fermer la navigation"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
        />
      ) : null}

      <aside
        aria-label="Navigation principale"
        data-collapsed={collapsed ? "" : undefined}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[17rem] shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar",
          "md:sticky md:top-0 md:z-30 md:h-dvh md:w-(--rail-width) md:translate-x-0",
          "transition-[width,transform] duration-(--motion-duration) ease-standard",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div
          className={cn(
            "flex h-14 shrink-0 items-center gap-2 border-b border-border px-4",
            collapsed && "md:justify-center md:px-0",
          )}
        >
          <Link
            href="/"
            onClick={onCloseMobile}
            aria-label="Antidotes, accueil"
            className="focus-visible:ring-ring min-w-0 rounded-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            {collapsed ? (
              <span
                aria-hidden
                className="text-h3 hidden text-accent-ink md:block"
              >
                A
              </span>
            ) : (
              <Wordmark />
            )}
          </Link>

          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Fermer la navigation"
            className="hover:bg-muted focus-visible:ring-ring ml-auto rounded-sm p-1.5 text-text-secondary focus-visible:ring-2 focus-visible:outline-none md:hidden"
          >
            <X className="size-4.5" strokeWidth={1.75} aria-hidden />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <div key={group.title} className="mb-5 last:mb-0">
              <p
                className={cn(
                  "text-overline mb-1.5 px-2 text-text-tertiary",
                  collapsed && "md:sr-only",
                )}
              >
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {group.entries.map((entry) => (
                  <li key={entry.href}>
                    <SidebarLink
                      entry={entry}
                      active={isActive(entry, pathname)}
                      collapsed={collapsed}
                      onNavigate={onCloseMobile}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="hidden shrink-0 border-t border-border p-3 md:block">
          <button
            type="button"
            onClick={() => setRail(!collapsed)}
            aria-label={collapsed ? "Déplier la navigation" : "Replier la navigation"}
            aria-pressed={collapsed}
            className={cn(
              "text-label hover:bg-muted focus-visible:ring-ring flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-text-secondary transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
              collapsed && "justify-center",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4.5 shrink-0" strokeWidth={1.75} aria-hidden />
            ) : (
              <>
                <PanelLeftClose className="size-4.5 shrink-0" strokeWidth={1.75} aria-hidden />
                Replier
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}

function SidebarLink({
  entry,
  active,
  collapsed,
  onNavigate,
}: {
  entry: NavEntry;
  active: boolean;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const Icon = ICONS[entry.icon];

  return (
    <Link
      href={entry.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? entry.label : undefined}
      className={cn(
        "text-label focus-visible:ring-ring relative flex items-center gap-3 rounded-md py-2 pr-2.5 transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
        // La barre active occupe le retrait gauche : sans lui, elle décalerait
        // l'icône de trois pixels en devenant visible.
        "pl-2.5",
        active
          ? "bg-accent-subtle font-medium text-accent-ink"
          : "text-text-secondary hover:bg-muted hover:text-text-primary",
        collapsed && "md:justify-center md:px-0",
      )}
    >
      {active ? (
        <span
          aria-hidden
          className="absolute inset-y-1.5 left-0 w-[3px] rounded-pill bg-brand"
        />
      ) : null}

      {entry.accent ? (
        <span
          aria-hidden
          className="size-4.5 shrink-0 rounded-sm"
          style={{ backgroundColor: entry.accent }}
        />
      ) : (
        <Icon className="size-4.5 shrink-0" strokeWidth={1.75} aria-hidden />
      )}

      <span className={cn("truncate", collapsed && "md:sr-only")}>{entry.label}</span>
    </Link>
  );
}
