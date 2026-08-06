"use client";

import { useEffect, useRef } from "react";

import {
  CHANNEL_LABELS,
  FLAG_LABELS,
  STATUS_LABELS,
  type Conversation,
} from "@/lib/moderation/types";
import { cn } from "@/lib/utils";

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
      <div className="border-border text-muted-foreground flex w-96 shrink-0 items-center justify-center border-r p-8 text-center text-sm">
        Aucune conversation ne correspond à ces filtres.
      </div>
    );
  }

  return (
    <ul
      className="border-border w-96 shrink-0 overflow-y-auto border-r"
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
                "border-border focus-visible:ring-brand w-full border-b px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:-outline-offset-2",
                active ? "bg-card" : "hover:bg-card/60",
              )}
            >
              <div className="flex items-baseline gap-2">
                {conversation.unread ? (
                  <span
                    aria-label="Non lu"
                    className="bg-brand mt-1.5 size-1.5 shrink-0 rounded-full"
                  />
                ) : (
                  <span className="mt-1.5 size-1.5 shrink-0" />
                )}
                <span className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
                  {conversation.participant_handle ?? "Inconnu"}
                </span>
                <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                  {relativeTime(conversation.last_message_at)}
                </span>
              </div>

              <p className="text-muted-foreground mt-1 line-clamp-2 pl-3.5 text-xs">
                {conversation.excerpt}
              </p>

              <div className="mt-1.5 flex flex-wrap items-center gap-1 pl-3.5">
                <Tag>{CHANNEL_LABELS[conversation.channel]}</Tag>
                <Tag>{STATUS_LABELS[conversation.status]}</Tag>
                {conversation.flags.map((flag) => (
                  <Tag key={flag} tone="alert">
                    {FLAG_LABELS[flag]}
                  </Tag>
                ))}
                {conversation.detected_locale === "en" ? <Tag>EN</Tag> : null}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Tag({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "alert";
}) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] leading-none font-medium",
        tone === "alert"
          ? "bg-danger-subtle text-danger-ink"
          : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
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
