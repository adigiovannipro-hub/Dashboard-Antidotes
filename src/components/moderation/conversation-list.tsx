"use client";

import { useEffect, useRef } from "react";

import { StatusPill, type StatusTone } from "@/components/ds/status-pill";
import type { ClientChip } from "@/components/moderation/inbox-filter-bar";
import {
  CHANNEL_LABELS,
  FLAG_LABELS,
  KIND_LABELS,
  STATUS_LABELS,
  type Conversation,
  type ConversationStatus,
} from "@/lib/moderation/types";
import { cn } from "@/lib/utils";

/**
 * Ce que chaque statut demande de moi.
 *
 * `to_process` et `awaiting_validation` attendent une action — ambre. Un envoi
 * en échec est une alerte. `validated` est en route mais pas encore parti :
 * favorable, sans être clos. Le reste est classé : ni bon, ni mauvais, neutre.
 */
const STATUS_TONES: Record<ConversationStatus, StatusTone> = {
  to_process: "warning",
  awaiting_validation: "warning",
  validated: "positive",
  snoozed: "neutral",
  sent: "positive",
  send_failed: "danger",
  ignored: "neutral",
  answered_elsewhere: "neutral",
};

/**
 * Le volet de gauche : la liste.
 *
 * Dense par choix — l'objectif est cent messages en dix minutes, donc une
 * ligne doit se lire d'un coup d'œil : qui, quoi, quand, chez quel client,
 * sous quelle publication, avec quelle urgence.
 */
export function ConversationList({
  conversations,
  clients,
  showClient,
  selectedId,
  emptyMessage,
  onSelect,
}: {
  conversations: Conversation[];
  clients: Map<string, ClientChip>;
  /** Vrai en vue croisée : chaque ligne rappelle son client. */
  showClient: boolean;
  selectedId: string | null;
  emptyMessage: string;
  onSelect: (id: string) => void;
}) {
  const selectedRef = useRef<HTMLButtonElement>(null);

  // La navigation au clavier doit garder la sélection visible sans faire sauter
  // toute la page : `nearest` défile la colonne uniquement si nécessaire.
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  if (conversations.length === 0) {
    return (
      <div className="type-body flex h-full items-center justify-center p-8 text-center text-text-secondary">
        {emptyMessage}
      </div>
    );
  }

  return (
    <ul aria-label="Conversations">
      {conversations.map((conversation) => {
        const active = conversation.id === selectedId;
        const client = clients.get(conversation.client_id);
        return (
          <li key={conversation.id}>
            <button
              ref={active ? selectedRef : undefined}
              type="button"
              onClick={() => onSelect(conversation.id)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "focus-visible:ring-ring relative w-full border-b border-border px-3 py-2.5 text-left transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none",
                // La sélection se marque par la menthe et un filet vert à
                // gauche, comme partout ailleurs.
                active ? "bg-accent-subtle/50" : "hover:bg-surface-sunken",
              )}
            >
              {active ? (
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-[3px] bg-brand"
                />
              ) : null}

              <div className="flex items-baseline gap-2">
                {conversation.unread ? (
                  <span
                    aria-label="Non lu"
                    className="mt-1.5 size-1.5 shrink-0 rounded-pill bg-brand"
                  />
                ) : (
                  <span className="mt-1.5 size-1.5 shrink-0" />
                )}
                <span className="type-label min-w-0 flex-1 truncate text-text-primary">
                  {conversation.participant_handle ?? "Inconnu"}
                </span>
                <span className="type-caption shrink-0 text-text-secondary tabular-nums">
                  {relativeTime(conversation.last_message_at)}
                </span>
              </div>

              <p className="type-caption mt-1 line-clamp-2 pl-3.5 text-text-primary/80">
                {conversation.excerpt}
              </p>

              {conversation.post_excerpt ? (
                // La publication commentée : c'est elle qui donne le contexte
                // d'un commentaire — sans elle, « oui, en bleu ! » ne se
                // modère pas.
                <p className="type-caption mt-0.5 truncate pl-3.5 text-text-secondary">
                  Sous « {conversation.post_excerpt} »
                </p>
              ) : null}

              <div className="mt-1.5 flex flex-wrap items-center gap-1 pl-3.5">
                {showClient && client ? (
                  <StatusPill tone="neutral" dot={false}>
                    {client.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- URL signée
                      <img
                        src={client.logoUrl}
                        alt=""
                        className="-ml-0.5 size-3.5 rounded-pill object-cover"
                      />
                    ) : null}
                    {client.name}
                  </StatusPill>
                ) : null}
                <StatusPill tone="neutral" dot={false}>
                  {conversation.kind === "comment"
                    ? CHANNEL_LABELS[conversation.channel]
                    : `${KIND_LABELS[conversation.kind]} · ${CHANNEL_LABELS[conversation.channel]}`}
                </StatusPill>
                <StatusPill tone={STATUS_TONES[conversation.status]}>
                  {STATUS_LABELS[conversation.status]}
                </StatusPill>
                {conversation.flags.map((flag) => (
                  <StatusPill key={flag} tone="danger">
                    {FLAG_LABELS[flag]}
                  </StatusPill>
                ))}
                {conversation.detected_locale === "en" ? (
                  <StatusPill tone="info" dot={false}>
                    EN
                  </StatusPill>
                ) : null}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.round(hours / 24)} j`;
}
