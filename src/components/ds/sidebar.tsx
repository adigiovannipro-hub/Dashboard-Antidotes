"use client";

import { useOptimistic, useState, useTransition, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Briefcase,
  CalendarClock,
  GraduationCap,
  KeyRound,
  Lock,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Sun,
  Target,
  Users,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { saveRailOrder } from "@/app/actions/rail";
import { useOptimisticPill } from "@/components/ds/pill-indicator";
import { LinkPending } from "@/components/ds/route-progress";
import { BodyPortal } from "@/components/planning/body-portal";
import { Wordmark } from "@/components/wordmark";
import { WorkspaceMenu } from "@/components/workspaces/workspace-menu";
import { safeAction } from "@/lib/context/safe-action";
import type { NavEntry, NavGroup, NavIcon } from "@/lib/navigation";
import {
  orderEntries,
  RAIL_GROUP_KEYS,
  reorderHrefs,
  type RailGroupKey,
} from "@/lib/navigation-order";
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
 *
 * Les lignes de « Clients » et de « Mon entreprise » se rangent à la souris,
 * chacune dans son groupe — un client ne devient pas un outil de l'agence en
 * changeant de tiroir.
 *
 * Le rangement est un **mode**, pas une poignée permanente : « Réarranger »,
 * dans les trois points d'un espace, fait gigoter les lignes déplaçables sous
 * un liseré vert, à la manière d'un iPhone qu'on réorganise. Une poignée
 * visible au survol occupait la ligne toute l'année pour un geste qu'on fait
 * deux fois ; le mouvement dit « attrape-moi » sans rien prendre au repos.
 * Pendant le mode la ligne n'est plus un lien mais un bouton : un clic
 * n'emmène nulle part, et le clavier reprend la main dessus.
 *
 * L'ordre se pose localement au lâcher, part en base derrière, et revient à sa
 * place avec un toast si l'écriture échoue. Rien de tout cela en rail replié
 * (plus de libellés) ni en mobile, où le tiroir défile au doigt et où un
 * capteur tactile lui volerait le défilement : le mode ne s'y ouvre pas.
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
  factures: CalendarClock,
  recus: Receipt,
  acces: KeyRound,
  academy: GraduationCap,
  antidotes: Target,
};

function isActive(entry: NavEntry, pathname: string): boolean {
  if (entry.match === "exact") return pathname === entry.href;
  return pathname === entry.href || pathname.startsWith(`${entry.href}/`);
}

type OrderUpdate = { key: RailGroupKey; hrefs: string[] };

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
  // Le rangement est un mode, ouvert depuis les trois points d'un espace.
  const [rearranging, setRearranging] = useState(false);

  // Le rail est le seul chemin qui **change de section** — de la Finance au
  // planning d'un client, par exemple. C'est aussi le plus lent : la coquille
  // entière est reconstruite par le serveur, et aucun squelette ne peut
  // s'intercaler puisque c'est le cadre lui-même qui est en train d'arriver.
  // L'entrée cliquée prend donc l'état actif tout de suite, et la route
  // reprend la main dès qu'elle a répondu.
  const { active: activePath, select } = useOptimisticPill(pathname);

  // Même mécanique que le kanban du pipeline : la ligne se pose au lâcher,
  // l'action part derrière, et l'état retombe sur ce que le serveur rend —
  // le nouvel ordre s'il a écrit, l'ancien s'il a refusé.
  const [orderedGroups, applyOrder] = useOptimistic(
    groups,
    (state: NavGroup[], update: OrderUpdate) =>
      state.map((group) =>
        RAIL_GROUP_KEYS[group.title] === update.key
          ? { ...group, entries: orderEntries(group.entries, update.hrefs) }
          : group,
      ),
  );
  const [, startTransition] = useTransition();

  function reorder(key: RailGroupKey, hrefs: string[]) {
    startTransition(async () => {
      applyOrder({ key, hrefs });
      const result = await safeAction(() => saveRailOrder({ group: key, hrefs }));
      if (!result.ok) toast.error(result.error);
    });
  }

  function toggle() {
    setCollapsed((previous) => {
      remember(!previous);
      return !previous;
    });
  }

  // Replier le rail retire les libellés, donc les lignes à saisir : le mode
  // n'aurait plus rien à montrer.
  if (collapsed && rearranging) setRearranging(false);

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
          "fixed inset-y-0 left-0 z-50 flex w-[16rem] shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar",
          "md:sticky md:top-0 md:z-30 md:h-dvh md:translate-x-0",
          // Le repli parcourt 11 rem : à 150 ms il saute plutôt qu'il ne
          // glisse. C'est un déplacement, il prend la durée des déplacements.
          "transition-[width,transform] duration-(--motion-duration-slow) ease-exit motion-reduce:transition-none",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          // Seize pixels rendus au contenu : le rail prenait trop de place à
          // gauche pour ce qu'il porte. Le `truncate` des libellés existait déjà.
          collapsed ? "md:w-16" : "md:w-56",
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

        {/* Le bandeau du mode : il dit ce qui se passe et comment en sortir.
            `Échap` fait la même chose — c'est le geste attendu d'un mode. */}
        {rearranging ? (
          <div
            className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-accent-subtle px-3 py-2"
            onKeyDown={(event) => {
              if (event.key === "Escape") setRearranging(false);
            }}
          >
            <p className="type-caption text-accent-ink">Glissez les lignes</p>
            <button
              type="button"
              autoFocus
              onClick={() => setRearranging(false)}
              className="type-caption focus-visible:ring-ring rounded-md bg-primary px-2.5 py-1 font-medium text-primary-foreground focus-visible:ring-2 focus-visible:outline-none"
            >
              Terminé
            </button>
          </div>
        ) : null}

        <nav
          className="min-h-0 flex-1 overflow-y-auto px-3 py-4"
          onKeyDown={(event) => {
            if (event.key === "Escape" && rearranging) setRearranging(false);
          }}
        >
          {orderedGroups.map((group) => {
            const sortKey: RailGroupKey | undefined = RAIL_GROUP_KEYS[group.title];
            const rowProps = {
              collapsed,
              activePath,
              rearranging,
              onRearrange: () => setRearranging(true),
              onNavigate: (href: string) => {
                select(href);
                onCloseMobile();
              },
            };
            return (
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
                {sortKey ? (
                  <SortableEntries
                    sortKey={sortKey}
                    entries={group.entries}
                    onReorder={(hrefs) => reorder(sortKey, hrefs)}
                    {...rowProps}
                  />
                ) : (
                  <ul className="space-y-0.5">
                    {group.entries.map((entry) => (
                      <EntryRow key={entry.href} entry={entry} {...rowProps} />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        {/* Les pages légales, en pied de rail et en tout petit.
            Elles doivent être **atteignables depuis l'application** : c'est
            ce que vérifie l'examinateur d'une plateforme dont on consomme
            l'API, et c'est aussi la moindre des choses pour un client. Mais
            elles ne sont pas de la navigation : ni icône, ni pastille, ni
            place dans un groupe — un pied de page, à la taille d'un pied de
            page.

            `text-text-secondary` et non `--text-tertiary` : 11 px suffisent à
            se faire discret, et l'encre tertiaire ne monte qu'à 2,79:1.
            Escamotées quand le rail est replié, comme les libellés : deux
            liens ne tiennent pas dans 64 px. */}
        <div
          className={cn(
            "shrink-0 border-t border-border px-4 py-3",
            collapsed && "md:hidden",
          )}
        >
          <p className="type-micro flex flex-wrap items-center gap-x-2 gap-y-1 text-text-secondary">
            <Link
              href="/confidentialite"
              onClick={onCloseMobile}
              className="focus-visible:ring-ring rounded-sm hover:text-text-primary hover:underline hover:underline-offset-2 focus-visible:ring-2 focus-visible:outline-none"
            >
              Confidentialité
            </Link>
            <span aria-hidden>·</span>
            <Link
              href="/cgu"
              onClick={onCloseMobile}
              className="focus-visible:ring-ring rounded-sm hover:text-text-primary hover:underline hover:underline-offset-2 focus-visible:ring-2 focus-visible:outline-none"
            >
              CGU
            </Link>
          </p>
        </div>

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

type RowProps = {
  collapsed: boolean;
  activePath: string;
  /** Le rail est en mode réarrangement : les lignes se saisissent. */
  rearranging: boolean;
  onRearrange: () => void;
  onNavigate: (href: string) => void;
};

/**
 * Un groupe dont les lignes se rangent. Un `DndContext` par groupe — c'est
 * ce qui interdit de déposer un client dans « Mon entreprise » sans avoir à
 * l'écrire — et un `id` fixe, sinon dnd-kit numérote ses `aria-describedby`
 * dans l'ordre de montage, différent entre le serveur et le navigateur.
 */
function SortableEntries({
  sortKey,
  entries,
  onReorder,
  ...rowProps
}: RowProps & {
  sortKey: RailGroupKey;
  entries: NavEntry[];
  onReorder: (hrefs: string[]) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    // Six pixels avant de saisir : en deçà, c'est un clic sur la poignée qui
    // n'a rien à faire, pas un déplacement raté.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const hrefs = entries.map((entry) => entry.href);
  const active = activeId ? (entries.find((entry) => entry.href === activeId) ?? null) : null;

  function labelOf(id: UniqueIdentifier): string {
    return entries.find((entry) => entry.href === String(id))?.label ?? "";
  }
  function positionOf(id: UniqueIdentifier): string {
    return `position ${hrefs.indexOf(String(id)) + 1} sur ${hrefs.length}`;
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const over = event.over?.id;
    if (typeof over !== "string" || over === event.active.id) return;
    const next = reorderHrefs(hrefs, String(event.active.id), over);
    if (next.every((href, index) => href === hrefs[index])) return;
    onReorder(next);
  }

  return (
    <DndContext
      id={`rail-${sortKey}`}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Espace ou Entrée pour saisir la ligne, flèches haut et bas pour la déplacer, Espace ou Entrée pour déposer, Échap pour annuler.",
        },
        announcements: {
          onDragStart: ({ active }) => `${labelOf(active.id)} saisi, ${positionOf(active.id)}.`,
          onDragOver: ({ active, over }) =>
            over
              ? `${labelOf(active.id)} en ${positionOf(over.id)}.`
              : `${labelOf(active.id)} hors de la liste.`,
          onDragEnd: ({ active, over }) =>
            over
              ? `${labelOf(active.id)} déposé en ${positionOf(over.id)}.`
              : "Déplacement annulé.",
          onDragCancel: () => "Déplacement annulé.",
        },
      }}
    >
      <SortableContext items={hrefs} strategy={verticalListSortingStrategy}>
        <ul className="space-y-0.5">
          {entries.map((entry, index) => (
            <SortableRow
              key={entry.href}
              entry={entry}
              index={index}
              sorting={activeId !== null}
              {...rowProps}
            />
          ))}
        </ul>
      </SortableContext>

      {/* Dans `<body>` et non dans le rail : l'`aside` porte un `transform`
          et un `overflow-hidden`, qui feraient de lui le repère d'un élément
          fixe et rogneraient la ligne dès qu'elle en sort. */}
      <BodyPortal>
        <DragOverlay dropAnimation={null}>
          {active ? (
            <div className="rounded-md bg-sidebar shadow-card-hover">
              <SidebarLink
                entry={active}
                active={isActive(active, rowProps.activePath)}
                collapsed={false}
                sortable={false}
                onNavigate={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </BodyPortal>
    </DndContext>
  );
}

function SortableRow({
  entry,
  sorting,
  collapsed,
  index,
  ...rowProps
}: RowProps & { entry: NavEntry; sorting: boolean; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.href,
    // Hors du mode, rien ne se saisit : la ligne reste un lien ordinaire.
    disabled: collapsed || !rowProps.rearranging,
    attributes: { roleDescription: "ligne déplaçable" },
  });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    /* Un décalage de phase par ligne : sans lui, tout le rail bat à
       l'unisson, ce qui ressemble à un défaut d'affichage plutôt qu'à des
       lignes qu'on peut attraper une par une. */
    animationDelay: rowProps.rearranging ? `${(index % 5) * 60}ms` : undefined,
  };

  return (
    <EntryRow
      entry={entry}
      collapsed={collapsed}
      rowRef={setNodeRef}
      style={style}
      dragging={isDragging}
      sorting={sorting}
      grab={rowProps.rearranging ? { ...attributes, ...listeners } : undefined}
      {...rowProps}
    />
  );
}

/**
 * Une ligne du rail : le lien, sa réserve de droite (trois points), et le
 * sous-menu des pages de l'espace.
 */
function EntryRow({
  entry,
  collapsed,
  activePath,
  rearranging,
  onRearrange,
  onNavigate,
  rowRef,
  style,
  grab,
  dragging = false,
  sorting = false,
}: RowProps & {
  entry: NavEntry;
  rowRef?: (node: HTMLElement | null) => void;
  style?: CSSProperties;
  /** Les écouteurs de saisie, quand le mode réarrangement est ouvert. */
  grab?: Record<string, unknown>;
  /** Cette ligne est celle qu'on tient : l'original s'efface sous l'overlay. */
  dragging?: boolean;
  /** Un glissement est en cours dans le groupe : les sous-menus ne
      s'ouvrent pas au passage, ils changeraient la hauteur des cibles. */
  sorting?: boolean;
}) {
  const active = isActive(entry, activePath);
  const grabbable = grab !== undefined;

  return (
    <li
      ref={rowRef}
      style={style}
      className={cn(
        "group/espace",
        dragging && "opacity-40",
        // Le gigotement ne porte que sur les lignes réellement déplaçables,
        // et s'arrête sur celle qu'on tient — elle suit déjà le curseur.
        grabbable && !dragging && "rail-remuer",
      )}
    >
      <div className="relative">
        <SidebarLink
          entry={entry}
          active={active}
          collapsed={collapsed}
          sortable={entry.manage !== undefined && !rearranging}
          grab={grab}
          onNavigate={() => onNavigate(entry.href)}
        />
        {/* Posés par-dessus la réserve de droite du lien : un bouton *dans*
            un lien n'est pas du HTML valide, et deux éléments côte à côte
            rogneraient le libellé. Retirés pendant le mode : les trois points
            avalaient le glissement démarré sur leur moitié de ligne. */}
        {entry.manage && !rearranging ? (
          <span className="absolute inset-y-0 right-1 flex items-center gap-0.5">
            <WorkspaceMenu
              slug={entry.manage.slug}
              name={entry.manage.name}
              collapsed={collapsed}
              onRearrange={onRearrange}
            />
          </span>
        ) : null}
      </div>

      {/* Le sous-menu des pages de l'espace. Au survol sur grand écran — le
          dépli est purement CSS, la hauteur glisse de 0fr à 1fr — et déplié
          en continu sur l'espace courant en mobile, où le survol n'existe
          pas. Rail replié : rien, il n'y a plus de libellés. */}
      {entry.children && !collapsed && !rearranging ? (
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-(--motion-duration-slow) ease-exit motion-reduce:transition-none",
            active ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
            "md:grid-rows-[0fr]",
            !sorting &&
              "md:group-hover/espace:grid-rows-[1fr] md:group-focus-within/espace:grid-rows-[1fr]",
          )}
        >
          <ul className="overflow-hidden">
            {entry.children.map((child) => {
              const childActive =
                activePath === child.href || activePath.startsWith(`${child.href}/`);
              return (
                <li key={child.href}>
                  <Link
                    href={child.href}
                    onClick={() => onNavigate(entry.href)}
                    aria-current={childActive ? "page" : undefined}
                    className={cn(
                      "type-caption focus-visible:ring-ring relative ml-[1.4rem] flex items-center rounded-md border-l border-border py-1.5 pl-4 transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
                      childActive
                        ? "font-medium text-accent-ink"
                        : "text-text-secondary hover:bg-muted hover:text-text-primary",
                    )}
                  >
                    <LinkPending />
                    <span className="truncate">{child.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

function SidebarLink({
  entry,
  active,
  collapsed,
  sortable,
  grab,
  onNavigate,
}: {
  entry: NavEntry;
  active: boolean;
  collapsed: boolean;
  /** Les trois points occupent la réserve de droite à partir de `md`. */
  sortable: boolean;
  /** Les écouteurs de saisie : la ligne devient un bouton, pas un lien. */
  grab?: Record<string, unknown>;
  onNavigate: () => void;
}) {
  const Icon = ICONS[entry.icon];
  // Zéro ne s'affiche pas : une pastille vide occupe la place d'une alerte
  // pour annoncer qu'il n'y en a pas.
  const showBadge = entry.badge !== undefined && entry.badge > 0;
  const manage = entry.manage !== undefined && !collapsed;

  const className = cn(
    "type-label focus-visible:ring-ring relative flex w-full items-center gap-3 rounded-md py-2 pr-2.5 transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
    // La barre active occupe le retrait gauche : sans lui, elle décalerait
    // l'icône de trois pixels en devenant visible.
    "pl-2.5",
    // Réserve la place des trois points — sinon le libellé passe dessous.
    manage && sortable && "pr-9",
    active
      ? "bg-accent-subtle font-medium text-accent-ink"
      : "text-text-secondary hover:bg-muted hover:text-text-primary",
    collapsed && "md:justify-center md:px-0",
    /* Le liseré du mode : `--accent-ink`, pas le vert de marque — celui-ci
       tombe à 2,71:1 sur la surface du rail, sous les 3:1 dus à un repère
       graphique porteur de sens. */
    grab && "cursor-grab touch-none text-left ring-1 ring-accent-ink active:cursor-grabbing",
  );

  const body = (
    <>
      <LinkPending />

      {/* Toujours rendue, jamais montée/démontée : une barre qui apparaît d'un
          coup ne dit pas que la sélection s'est déplacée, elle clignote. Elle
          se déplie depuis son centre en même temps que le fond s'installe. */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-1.5 left-0 w-[3px] rounded-pill bg-brand transition-[opacity,transform] duration-(--motion-duration) ease-exit motion-reduce:transition-none",
          active ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0",
        )}
      />

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
    </>
  );

  /* Pendant le mode, la ligne n'est plus un lien mais un bouton : un clic ne
     doit emmener nulle part, et c'est un bouton — pas un lien neutralisé —
     que le clavier et les lecteurs d'écran annoncent comme saisissable. */
  if (grab) {
    return (
      <button type="button" {...grab} aria-label={`Déplacer ${entry.label}`} className={className}>
        {body}
      </button>
    );
  }

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
      className={className}
    >
      {body}
    </Link>
  );
}
