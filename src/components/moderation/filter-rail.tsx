"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import type { InboxCounters, InboxFilters } from "@/lib/moderation/queries";
import {
  CHANNEL_LABELS,
  KIND_LABELS,
  STATUS_LABELS,
  V1_CHANNELS,
  type ConversationKind,
  type ConversationStatus,
} from "@/lib/moderation/types";
import { cn } from "@/lib/utils";

/**
 * Colonne de gauche : filtres par canal, statut, type, plus non-lus et priorité.
 *
 * Les filtres vivent dans l'URL. Un opérateur peut envoyer « les litiges
 * Instagram non traités » à un collègue par simple copie du lien, et le retour
 * arrière du navigateur fait ce qu'on attend.
 */
const STATUS_ORDER: ConversationStatus[] = [
  "to_process",
  "awaiting_validation",
  "snoozed",
  "sent",
  "send_failed",
  "ignored",
  "answered_elsewhere",
];

const KIND_ORDER: ConversationKind[] = ["dm", "comment", "story_mention"];

export function FilterRail({
  counters,
  filters,
}: {
  counters: InboxCounters;
  filters: InboxFilters;
}) {
  return (
    <nav
      aria-label="Filtres"
      className="w-52 shrink-0 overflow-y-auto border-r border-border bg-surface-sunken p-3"
    >
      <Section title="Canal">
        <FilterLink param="canal" value={undefined} active={!filters.channel}>
          Tous
        </FilterLink>
        {V1_CHANNELS.map((channel) => (
          <FilterLink
            key={channel}
            param="canal"
            value={channel}
            active={filters.channel === channel}
            count={counters.byChannel[channel]}
          >
            {CHANNEL_LABELS[channel]}
          </FilterLink>
        ))}
      </Section>

      <Section title="Statut">
        <FilterLink param="statut" value={undefined} active={!filters.status}>
          Tous
        </FilterLink>
        {STATUS_ORDER.map((status) => (
          <FilterLink
            key={status}
            param="statut"
            value={status}
            active={filters.status === status}
            count={counters.byStatus[status]}
          >
            {STATUS_LABELS[status]}
          </FilterLink>
        ))}
      </Section>

      <Section title="Type">
        <FilterLink param="type" value={undefined} active={!filters.kind}>
          Tous
        </FilterLink>
        {KIND_ORDER.map((kind) => (
          <FilterLink
            key={kind}
            param="type"
            value={kind}
            active={filters.kind === kind}
          >
            {KIND_LABELS[kind]}
          </FilterLink>
        ))}
      </Section>

      <Section title="Vues">
        <FilterLink
          param="nonlus"
          value={filters.unreadOnly ? undefined : "1"}
          active={Boolean(filters.unreadOnly)}
          count={counters.unread}
        >
          Non lus
        </FilterLink>
        <FilterLink
          param="priorite"
          value={filters.highPriorityOnly ? undefined : "1"}
          active={Boolean(filters.highPriorityOnly)}
          count={counters.highPriority}
        >
          Priorité haute
        </FilterLink>
      </Section>
    </nav>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <h2 className="type-overline mb-1.5 px-2 text-text-secondary">{title}</h2>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

function FilterLink({
  param,
  value,
  active,
  count,
  children,
}: {
  param: string;
  value: string | undefined;
  active: boolean;
  count?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const next = new URLSearchParams(searchParams.toString());
  if (value === undefined) next.delete(param);
  else next.set(param, value);
  // Changer de filtre change la liste : la conversation ouverte n'a plus de
  // raison de le rester.
  next.delete("conv");

  return (
    <li>
      <Link
        href={`${pathname}?${next}`}
        aria-current={active ? "true" : undefined}
        className={cn(
          "type-caption focus-visible:ring-ring flex items-center justify-between rounded-md px-2 py-1.5 transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
          // Même signature que le rail de navigation : une sélection se lit à
          // la menthe et à l'encre verte, partout dans l'application.
          active
            ? "bg-accent-subtle font-medium text-accent-ink"
            : "text-text-secondary hover:bg-surface hover:text-text-primary",
        )}
      >
        <span className="truncate">{children}</span>
        {count !== undefined && count > 0 ? (
          <span
            className={cn(
              // Un compteur est du texte : jamais la teinte tertiaire, qui ne
              // tient pas le contraste.
              "ml-2 shrink-0 tabular-nums",
              active ? "text-accent-ink" : "text-text-secondary",
            )}
          >
            {count}
          </span>
        ) : null}
      </Link>
    </li>
  );
}
