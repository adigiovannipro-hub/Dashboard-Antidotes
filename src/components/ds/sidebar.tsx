"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  CalendarClock,
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
import { WorkspaceMenu } from "@/components/workspaces/workspace-menu";
import type { NavEntry, NavGroup, NavIcon } from "@/lib/navigation";
import { PREFERENCE_MAX_AGE, RAIL_COOKIE } from "@/lib/ui-preferences";
import { cn } from "@/lib/utils";

/**
 * Le rail de navigation, présent sur tous les écrans applicatifs.
 *
 * Il remplace le hub comme point de passage obligé : jusqu'ici, aller de la
 * Finance au planning d'un client demandait un aller-retour par l'accueil.
 *
 * Repliable vers un rail d'icônes de 64 px, choix mémorisé dans un **cookie**
 * et non dans le stockage local. La raison est décisive : le cookie est lu par
 * le serveur, qui rend donc d'emblée le rail dans le bon état. Une valeur
 * gardée côté navigateur obligerait à corriger après coup — et une première
 * tentative par `useSyncExternalStore` ne se resynchronisait jamais après
 * l'hydratation, laissant les libellés visibles et tronqués dans un rail de
 * 64 px, avec un `aria-pressed` faux.
 */

function remember(collapsed: boolean) {
  document.cookie = `${RAIL_COOKIE}=${collapsed ? "1" : "0"}; path=/; max-age=${PREFERENCE_MAX_AGE}; samesite=lax`;
}

const ICONS: Record<NavIcon, LucideIcon> = {
  aujourdhui: Sun,
  client: Users,
  entreprise: Briefcase,
  perso: Lock,
  moderation: MessagesSquare,
  finance: Wallet,
  echeances: CalendarClock,
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
  initialCollapsed,
}: {
  groups: NavGroup[];
  mobileOpen: boolean;
  onCloseMobile: () => void;
  /** Lu du cookie par le serveur : le premier rendu est déjà le bon. */
  initialCollapsed: boolean;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    setCollapsed((previous) => {
      remember(!previous);
      return !previous;
    });
  }

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
          "md:sticky md:top-0 md:z-30 md:h-dvh md:translate-x-0",
          "transition-[width,transform] duration-(--motion-duration) ease-standard",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "md:w-16" : "md:w-60",
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
                className="type-h3 hidden text-accent-ink md:block"
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
                  // `--text-tertiary` ne monte qu'à 2,79:1 : il est réservé aux
                  // icônes et aux ornements, jamais à du texte.
                  "type-overline mb-1.5 px-2 text-text-secondary",
                  collapsed && "md:sr-only",
                )}
              >
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {group.entries.map((entry) => (
                  <li key={entry.href} className="group/espace relative">
                    <SidebarLink
                      entry={entry}
                      active={isActive(entry, pathname)}
                      collapsed={collapsed}
                      onNavigate={onCloseMobile}
                    />
                    {/* Posé par-dessus la réserve de droite du lien : un
                        bouton *dans* un lien n'est pas du HTML valide, et
                        deux éléments côte à côte rogneraient le libellé. */}
                    {entry.manage ? (
                      <span className="absolute inset-y-0 right-1 flex items-center">
                        <WorkspaceMenu
                          slug={entry.manage.slug}
                          name={entry.manage.name}
                          collapsed={collapsed}
                        />
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="hidden shrink-0 border-t border-border p-3 md:block">
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Déplier la navigation" : "Replier la navigation"}
            aria-pressed={collapsed}
            className={cn(
              "type-label hover:bg-muted focus-visible:ring-ring flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-text-secondary transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
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
  // Zéro ne s'affiche pas : une pastille vide occupe la place d'une alerte
  // pour annoncer qu'il n'y en a pas.
  const showBadge = entry.badge !== undefined && entry.badge > 0;

  return (
    <Link
      href={entry.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={
        collapsed
          ? showBadge
            ? `${entry.label} — ${entry.badge} en attente`
            : entry.label
          : undefined
      }
      className={cn(
        "type-label focus-visible:ring-ring relative flex items-center gap-3 rounded-md py-2 pr-2.5 transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
        // La barre active occupe le retrait gauche : sans lui, elle décalerait
        // l'icône de trois pixels en devenant visible.
        "pl-2.5",
        // Réserve la place des trois points, sinon le libellé passe dessous.
        entry.manage && !collapsed && "pr-9",
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

      <span className="relative shrink-0">
        {entry.logo ? (
          /* Le logo remplace la pastille. `rounded-sm` et non un cercle : un
             logo rectangulaire rogné en rond perd son nom. `contain` plutôt
             que `cover`, pour la même raison. */
          // eslint-disable-next-line @next/next/no-img-element -- URL signée
          <img
            src={entry.logo}
            alt=""
            aria-hidden
            className="block size-4.5 rounded-sm object-contain"
          />
        ) : entry.accent ? (
          <span
            aria-hidden
            className="block size-4.5 rounded-sm"
            style={{ backgroundColor: entry.accent }}
          />
        ) : (
          <Icon className="block size-4.5" strokeWidth={1.75} aria-hidden />
        )}

        {/* Rail replié : le nombre ne tient plus, un point le remplace. Sans
            lui, replier le rail ferait disparaître l'alerte — et on replie
            justement pour gagner de la place, pas pour perdre l'information. */}
        {showBadge ? (
          <span
            aria-hidden
            className={cn(
              "absolute -top-1 -right-1 hidden size-2 rounded-pill bg-text-secondary ring-2 ring-sidebar",
              collapsed && "md:block",
            )}
          />
        ) : null}
      </span>

      <span className={cn("truncate", collapsed && "md:sr-only")}>{entry.label}</span>

      {showBadge ? (
        <span
          className={cn(
            // Gris et non rouge : ces compteurs sont là en permanence. Une
            // pastille d'alerte qui ne s'éteint jamais cesse d'alerter.
            "type-caption ml-auto shrink-0 rounded-pill bg-surface-sunken px-1.5 py-0.5 font-medium text-text-secondary tabular-nums",
            collapsed && "md:hidden",
          )}
        >
          {entry.badge}
          <span className="sr-only"> en attente</span>
        </span>
      ) : null}
    </Link>
  );
}
