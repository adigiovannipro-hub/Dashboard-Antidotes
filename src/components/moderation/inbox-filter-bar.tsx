"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { PlatformIcon } from "@/components/planning/platform-icon";
import type { InboxCounters, InboxSelection } from "@/lib/moderation/counters";
import {
  SEGMENT_LABELS,
  SEGMENT_ORDER,
  serializeNetworks,
  toggleNetwork,
} from "@/lib/moderation/filters";
import { CHANNEL_LABELS, type ModerationChannel } from "@/lib/moderation/types";
import type { PlanningPlatform } from "@/lib/planning/types";
import { cn } from "@/lib/utils";

/**
 * Les filtres de l'Inbox, tous dans l'URL en français.
 *
 * Deux rangées, deux niveaux qui ne se ressemblent pas :
 *
 *   • les **réseaux** en logos cochables, plusieurs à la fois — on traite
 *     souvent Instagram et Facebook ensemble, et l'ancien jeu d'onglets
 *     obligeait à choisir. Chaque logo porte son compteur, **même à zéro** :
 *     une icône qui disparaît décale la rangée et l'on clique à côté ;
 *   • les **clients** en jetons à vignette, puis le **segment de statut** en
 *     contrôle à trois positions — il y en a toujours une d'active, « Toutes »
 *     n'existe plus.
 *
 * Non lus, Signalées et Messages privés sont des **bascules** : elles se
 * cumulent avec tout le reste, et leur état se lit à l'encre verte.
 *
 * Les compteurs se répondent : un badge n'annonce jamais des conversations
 * que le clic ne montrera pas (voir `deriveCounters` et son invariant).
 */

export type ClientChip = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
};

/** Le canal d'une conversation vers le logo du planning, quand il existe. */
const PLATFORM_OF: Record<ModerationChannel, PlanningPlatform> = {
  instagram: "instagram",
  facebook: "facebook",
  youtube: "youtube",
  linkedin: "linkedin",
  tiktok: "tiktok",
  whatsapp: "other",
  google_reviews: "other",
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
  networks,
  selection,
  clientSlug,
  trailing,
}: {
  clients: ClientChip[];
  counters: InboxCounters;
  /** Les réseaux à montrer, relevés ou présents dans les données. */
  networks: ModerationChannel[];
  selection: InboxSelection;
  clientSlug: string | null;
  /** Recherche, relevé, aide-mémoire — portés par l'Inbox. */
  trailing?: React.ReactNode;
}) {
  const buildHref = useHrefBuilder();

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <nav
          aria-label="Réseaux"
          className="flex max-w-full flex-wrap items-center gap-1.5"
        >
          <NetworkToggle
            active={selection.networks.length === 0}
            href={buildHref({ reseau: null })}
            label="Tous les réseaux"
          />
          {networks.map((channel) => {
            const active = selection.networks.includes(channel);
            return (
              <NetworkToggle
                key={channel}
                active={active}
                href={buildHref({
                  reseau: serializeNetworks(toggleNetwork(selection.networks, channel)),
                })}
                label={CHANNEL_LABELS[channel]}
                platform={PLATFORM_OF[channel]}
                count={counters.byNetwork[channel] ?? 0}
              />
            );
          })}
        </nav>

        {/* `flex-wrap` : la fraîcheur, la recherche et le relevé font 440 px à
            elles trois, et poussaient le corps de la page de 66 px sur un
            téléphone de 390. Elles se replient plutôt que de déborder. */}
        {trailing ? (
          <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">
            {trailing}
          </div>
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
                count={counters.byClient[client.id] ?? 0}
              >
                {client.name}
              </ClientLink>
            ))}
          </nav>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 md:ml-auto">
          {/* Le segment de statut : trois positions, une seule active. Un
              quatrième onglet « Toutes » qui contient les trois autres n'est
              pas un filtre — c'est leur absence, et le travail du jour s'y
              noyait sous des centaines de fils classés. */}
          <nav
            aria-label="Statut"
            className="flex items-center gap-0.5 rounded-pill bg-surface-sunken p-0.5"
          >
            {SEGMENT_ORDER.map((group) => (
              <Link
                key={group}
                href={buildHref({ statut: group })}
                aria-current={selection.statusGroup === group ? "true" : undefined}
                className={cn(
                  "type-caption focus-visible:ring-ring rounded-pill px-2.5 py-1 font-medium transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
                  selection.statusGroup === group
                    ? "bg-surface text-text-primary shadow-card"
                    : "text-text-secondary hover:text-text-primary",
                )}
              >
                {SEGMENT_LABELS[group]}
                <span className="ml-1 tabular-nums">
                  {counters.byStatusGroup[group]}
                </span>
              </Link>
            ))}
          </nav>

          <nav aria-label="Bascules" className="flex flex-wrap items-center gap-1">
            <Toggle
              active={selection.unreadOnly}
              href={buildHref({ nonlus: selection.unreadOnly ? null : "1" })}
              count={counters.unread}
              /* Le seul filtre qui appelle : quand il reste du neuf, la
                 bascule porte la pastille de marque et l'encre primaire —
                 c'est le chemin vers les nouveaux messages, il doit se voir
                 sans le chercher. */
              highlight
            >
              Non lus
            </Toggle>
            <Toggle
              active={selection.flaggedOnly}
              href={buildHref({ signalees: selection.flaggedOnly ? null : "1" })}
              count={counters.flagged}
            >
              Signalées
            </Toggle>
            <Toggle
              active={selection.dmOnly}
              href={buildHref({ mp: selection.dmOnly ? null : "1" })}
            >
              Messages privés
            </Toggle>
          </nav>
        </div>
      </div>
    </div>
  );
}

/**
 * Un réseau cochable. Le logo porte l'identité, le compteur la charge ; le
 * nom reste lisible au lecteur d'écran et disparaît sous `sm`, où trois
 * libellés complets ne tiennent pas.
 */
function NetworkToggle({
  active,
  href,
  label,
  platform,
  count,
}: {
  active: boolean;
  href: string;
  label: string;
  platform?: PlanningPlatform;
  count?: number;
}) {
  return (
    <Link
      href={href}
      aria-pressed={active}
      aria-label={label}
      role="button"
      className={cn(
        "type-caption focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 font-medium transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
        active
          ? "border-accent-ink/30 bg-accent-subtle text-accent-ink"
          : "border-border bg-surface text-text-secondary hover:text-text-primary",
      )}
    >
      {platform ? <PlatformIcon platform={platform} className="size-4" /> : null}
      {/* Le nom disparaît sous `sm`, où trois libellés complets ne tiennent
          pas : le logo suffit, et `aria-label` porte le nom au lecteur
          d'écran dans les deux cas — un second nœud en `sr-only` le lui
          ferait entendre deux fois au-dessus de `sm`. */}
      <span className={platform ? "hidden sm:inline" : undefined}>{label}</span>
      {count === undefined ? null : (
        <span className="tabular-nums">{count}</span>
      )}
    </Link>
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
      {count === undefined ? null : <span className="tabular-nums">{count}</span>}
    </Link>
  );
}

/** Une bascule : elle s'ajoute au reste, elle ne remplace rien. */
function Toggle({
  active,
  href,
  count,
  highlight = false,
  children,
}: {
  active: boolean;
  href: string;
  /** Ce que le clic montrera. Omis, la bascule n'affiche aucun nombre. */
  count?: number;
  /** Au repos mais non vide, la bascule s'allume au lieu de s'effacer. */
  highlight?: boolean;
  children: React.ReactNode;
}) {
  const calling = !active && highlight && (count ?? 0) > 0;
  return (
    <Link
      href={href}
      role="button"
      aria-pressed={active}
      className={cn(
        "type-caption focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 font-medium transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
        active
          ? "border-accent-ink/30 bg-accent-subtle text-accent-ink"
          : calling
            ? "border-border bg-surface text-text-primary hover:bg-surface-sunken"
            : "border-transparent text-text-secondary hover:bg-surface-sunken hover:text-text-primary",
      )}
    >
      {calling ? (
        <span aria-hidden className="size-2 shrink-0 rounded-pill bg-brand" />
      ) : null}
      {children}
      {count === undefined ? null : <span className="tabular-nums">{count}</span>}
    </Link>
  );
}
