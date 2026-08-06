"use client";

import { useEffect, useRef } from "react";

import { StatusPill, type StatusTone } from "@/components/ds/status-pill";
import {
  CHANNEL_LABELS,
  FLAG_LABELS,
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
 * Colonne du milieu : la liste.
 *
 * Dense par choix — l'objectif est cent messages en dix minutes, donc une ligne
 * doit tenir en trois lignes de texte et se lire d'un coup d'œil : qui, quoi,
 * quand, sur quel canal, avec quelle urgence.
 */
export function ConversationList({
  conversations,
  selectedId,
  onSelect,
}: {
  conversations: Conversation[];
  selectedId: string | null;
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
      <div className="type-body flex w-96 shrink-0 items-center justify-center border-r border-border p-8 text-center text-text-secondary">
        Aucune conversation ne correspond à ces filtres.
      </div>
    );
  }

  return (
    <ul
      className="w-96 shrink-0 overflow-y-auto border-r border-border"
      aria-label="Conversations"
    >
      {conversations.map((conversation) => {
        const active = conversation.id === selectedId;
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

              <p className="type-caption mt-1 line-clamp-2 pl-3.5 text-text-secondary">
                {conversation.excerpt}
              </p>

              <div className="mt-1.5 flex flex-wrap items-center gap-1 pl-3.5">
                <StatusPill tone="neutral" dot={false}>
                  {CHANNEL_LABELS[conversation.channel]}
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
