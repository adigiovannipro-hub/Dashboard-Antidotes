"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { FilterPills } from "@/components/ds/filter-pills";
import type { InboxCounters } from "@/lib/moderation/queries";
import {
  STATUS_GROUP_LABELS,
  STATUS_GROUP_ORDER,
  VIEW_LABELS,
  VIEW_ORDER,
  type InboxView,
  type StatusGroup,
} from "@/lib/moderation/types";
import { cn } from "@/lib/utils";

/**
 * Les filtres de l'inbox croisée, tous dans l'URL en français.
 *
 * Deux rangées, deux niveaux qui ne se ressemblent pas :
 *
 *   • les **canaux** en pastilles pleines dans une gouttière — le vocabulaire
 *     de la Boîte de réception Meta (Tout, Commentaires Instagram,
 *     Commentaires Facebook, Messages privés), compteurs d'à-traiter compris ;
 *   • les **clients** en jetons bordés à vignette, et les **statuts** en liens
 *     compacts — la sélection s'y lit à la menthe et à l'encre verte, comme
 *     partout.
 *
 * Les compteurs se répondent : un badge n'annonce jamais des conversations
 * que le clic ne montrera pas (voir `getInboxCounters`).
 */

export type ClientChip = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
};

function useHrefBuilder() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (mutations: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(mutations)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    // Changer un filtre change la liste : la conversation ouverte n'a plus de
    // raison de le rester.
    next.delete("conv");
    const query = next.toString();
    return query ? `${pathname}?${query}` : pathname;
  };
}

export function InboxFilterBar({
  clients,
  counters,
  view,
  statusGroup,
  clientSlug,
  unreadOnly,
  highPriorityOnly,
  trailing,
}: {
  clients: ClientChip[];
  counters: InboxCounters;
  view: InboxView;
  statusGroup: StatusGroup;
  clientSlug: string | null;
  unreadOnly: boolean;
  highPriorityOnly: boolean;
  /** Recherche, relevé, aide-mémoire — portés par l'inbox. */
  trailing?: React.ReactNode;
}) {
  const buildHref = useHrefBuilder();

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <FilterPills
          ariaLabel="Canaux"
          current={view}
          className="max-w-full overflow-x-auto"
          options={VIEW_ORDER.map((entry) => ({
            value: entry,
            label: VIEW_LABELS[entry],
            href: buildHref({ vue: entry === "tout" ? null : entry }),
            count: counters.byView[entry],
          }))}
        />
        {trailing ? (
          <div className="ml-auto flex items-center gap-2">{trailing}</div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {clients.length > 1 ? (
          <nav aria-label="Clients" className="flex flex-wrap items-center gap-1.5">
            <ClientLink
              active={clientSlug === null}
              href={buildHref({ client: null })}
            >
              Tous les clients
            </ClientLink>
            {clients.map((client) => (
              <ClientLink
                key={client.id}
                active={clientSlug === client.slug}
                href={buildHref({ client: client.slug })}
                logoUrl={client.logoUrl}
                name={client.name}
                count={counters.byClient[client.id]}
              >
                {client.name}
              </ClientLink>
            ))}
          </nav>
        ) : null}

        <nav
          aria-label="Statuts"
          className="flex flex-wrap items-center gap-1 md:ml-auto"
        >
          {/* Un seul chiffre dans cette rangée : le reste à faire. Compter
              aussi le traité et le total noyait la seule information utile.
              « Toutes » est le défaut, donc la valeur absente de l'URL. */}
          {STATUS_GROUP_ORDER.map((group) => (
            <SmallFilterLink
              key={group}
              active={statusGroup === group}
              href={buildHref({ statut: group === "toutes" ? null : group })}
              count={group === "a-traiter" ? counters.byStatusGroup[group] : undefined}
            >
              {STATUS_GROUP_LABELS[group]}
            </SmallFilterLink>
          ))}

          <span aria-hidden className="mx-1.5 h-4 w-px bg-border" />

          <SmallFilterLink
            active={unreadOnly}
            href={buildHref({ nonlus: unreadOnly ? null : "1" })}
          >
            Non lus
          </SmallFilterLink>
          <SmallFilterLink
            active={highPriorityOnly}
            href={buildHref({ priorite: highPriorityOnly ? null : "1" })}
          >
            Signalées
          </SmallFilterLink>
        </nav>
      </div>
    </div>
  );
}

function ClientLink({
  active,
  href,
  logoUrl,
  name,
  count,
  children,
}: {
  active: boolean;
  href: string;
  logoUrl?: string | null;
  name?: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "type-caption focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 font-medium transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
        active
          ? "border-accent-ink/25 bg-accent-subtle text-accent-ink"
          : "border-border bg-surface text-text-secondary hover:text-text-primary",
      )}
    >
      {name ? (
        logoUrl ? (
          // La vignette est décorative : le nom est juste à côté.
          // eslint-disable-next-line @next/next/no-img-element -- URL signée
          <img src={logoUrl} alt="" className="size-4 rounded-pill object-cover" />
        ) : (
          <span
            aria-hidden
            className="flex size-4 items-center justify-center rounded-pill bg-surface-sunken text-[9px] font-semibold uppercase"
          >
            {name.charAt(0)}
          </span>
        )
      ) : null}
      {children}
      {count ? <span className="tabular-nums">{count}</span> : null}
    </Link>
  );
}

function SmallFilterLink({
  active,
  href,
  count,
  children,
}: {
  active: boolean;
  href: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "type-caption focus-visible:ring-ring rounded-md px-2 py-1 font-medium transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
        active
          ? "bg-accent-subtle text-accent-ink"
          : "text-text-secondary hover:bg-surface-sunken hover:text-text-primary",
      )}
    >
      {children}
      {count ? <span className="ml-1 tabular-nums">{count}</span> : null}
    </Link>
  );
}
