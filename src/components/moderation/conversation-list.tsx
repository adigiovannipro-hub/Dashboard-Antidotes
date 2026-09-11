"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, CheckCheck } from "lucide-react";

import type { InboxGesture } from "@/app/actions/moderation";
import { StatusPill, type StatusTone } from "@/components/ds/status-pill";
import type { ClientChip } from "@/components/moderation/inbox-filter-bar";
import { ParticipantAvatar } from "@/components/moderation/participant-avatar";
import { RowActions } from "@/components/moderation/row-actions";
import {
  FLAG_LABELS,
  KIND_LABELS,
  participantLabel,
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
  selectedIds,
  emptyMessage,
  pending,
  onSelect,
  onToggle,
  onGesture,
}: {
  conversations: Conversation[];
  clients: Map<string, ClientChip>;
  /** Vrai en vue croisée : chaque ligne rappelle son client. */
  showClient: boolean;
  selectedId: string | null;
  /** Les lignes cochées — la sélection multiple, distincte de l'ouverture. */
  selectedIds: Set<string>;
  emptyMessage: string;
  pending: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string, checked: boolean) => void;
  onGesture: (ids: string[], gesture: InboxGesture) => void;
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
        const checked = selectedIds.has(conversation.id);
        const client = clients.get(conversation.client_id);
        return (
          <li key={conversation.id} className="group relative">
            <SwipeRow
              onRight={() => onGesture([conversation.id], "traitee")}
              onLeft={() => onGesture([conversation.id], "archiver")}
            >
              {/* La coche est **hors** du bouton d'ouverture : cocher pour agir
                en lot et ouvrir pour lire sont deux gestes, et une case dans
                un bouton coche en ouvrant. */}
              <label
                className="absolute top-2.5 left-2.5 z-10 flex size-5 cursor-pointer items-center justify-center"
                onClick={(event) => event.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) =>
                    onToggle(conversation.id, event.target.checked)
                  }
                  aria-label={`Sélectionner la conversation de ${participantLabel(conversation.participant_handle)}`}
                  className="focus-visible:ring-ring size-4 cursor-pointer rounded-sm border-border accent-[var(--accent-ink)] focus-visible:ring-2 focus-visible:outline-none"
                />
              </label>

              <RowActions
                unread={conversation.unread}
                archived={conversation.status === "ignored"}
                postPermalink={conversation.post_permalink}
                pending={pending}
                onGesture={(gesture) => onGesture([conversation.id], gesture)}
              />

              <button
                ref={active ? selectedRef : undefined}
                type="button"
                onClick={() => onSelect(conversation.id)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "focus-visible:ring-ring relative w-full border-b border-border py-2.5 pr-3 pl-9 text-left transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none",
                  // La sélection se marque par la menthe et un filet vert à
                  // gauche, comme partout ailleurs. Une ligne cochée se teinte
                  // aussi : sans ça, la barre annonce « 3 » sans qu'on voie
                  // lesquelles.
                  active
                    ? "bg-accent-subtle/50"
                    : checked
                      ? "bg-surface-sunken"
                      : "hover:bg-surface-sunken",
                )}
              >
                {active ? (
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-[3px] bg-brand"
                  />
                ) : null}

                {/* La photo d'abord : qui parle, sur quel réseau, chez quel
                  client — trois informations dans une vignette, là où trois
                  pastilles de texte demandaient de lire. */}
                <div className="flex items-start gap-2.5">
                  <ParticipantAvatar
                    handle={conversation.participant_handle}
                    avatarUrl={conversation.participant_avatar_url}
                    channel={conversation.channel}
                    clientLogoUrl={showClient ? client?.logoUrl : null}
                    clientName={showClient ? client?.name : null}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span
                        className={cn(
                          "type-label min-w-0 flex-1 truncate",
                          conversation.unread && "font-semibold",
                          conversation.participant_handle
                            ? "text-text-primary"
                            : // Un auteur que Meta masque n'est pas un pseudo :
                              // il se lit en secondaire, comme l'information
                              // qu'il est.
                              "text-text-secondary italic",
                        )}
                      >
                        {participantLabel(conversation.participant_handle)}
                      </span>
                      {conversation.unread ? (
                        <span
                          aria-label="Non lu"
                          className="size-2 shrink-0 rounded-pill bg-brand"
                        />
                      ) : null}
                      <span className="type-caption mr-14 shrink-0 text-text-secondary tabular-nums">
                        {relativeTime(conversation.last_message_at)}
                      </span>
                    </div>

                    <p
                      className={cn(
                        "type-caption mt-0.5 line-clamp-2",
                        conversation.unread
                          ? "text-text-primary"
                          : "text-text-primary/75",
                      )}
                    >
                      {conversation.excerpt}
                    </p>

                    {conversation.post_excerpt ? (
                      // La publication commentée : c'est elle qui donne le
                      // contexte — sans elle, « oui, en bleu ! » ne se modère pas.
                      <p className="type-caption mt-0.5 truncate text-text-secondary">
                        Sous « {conversation.post_excerpt} »
                      </p>
                    ) : null}

                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {conversation.kind !== "comment" ? (
                        <StatusPill tone="neutral" dot={false}>
                          {KIND_LABELS[conversation.kind]}
                        </StatusPill>
                      ) : null}
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
                  </div>
                </div>
              </button>
            </SwipeRow>
          </li>
        );
      })}
    </ul>
  );
}

/** Au-delà, le doigt a tranché. En deçà, la ligne revient à sa place. */
const SWIPE_THRESHOLD = 72;

/**
 * Le glissement du doigt sur une ligne, au téléphone.
 *
 * Vers la droite : traitée. Vers la gauche : rangée. C'est le geste de toutes
 * les boîtes de réception mobiles, et il évite d'aller chercher une vignette
 * de 32 px qui n'apparaît qu'au survol — un survol qui n'existe pas au doigt.
 *
 * Le glissement ne s'engage que si le doigt part **plus à l'horizontale qu'à
 * la verticale** : sans cette garde, faire défiler la liste déclenche un
 * rangement une fois sur trois.
 */
function SwipeRow({
  onLeft,
  onRight,
  children,
}: {
  onLeft: () => void;
  onRight: () => void;
  children: React.ReactNode;
}) {
  const [dx, setDx] = useState(0);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const engaged = useRef(false);

  return (
    <div className="relative overflow-hidden md:overflow-visible">
      {/* Les deux repères sous la ligne : on voit ce que le geste va faire
          avant de lâcher. */}
      {dx !== 0 ? (
        <div
          aria-hidden
          className="absolute inset-0 flex items-center justify-between px-4 md:hidden"
        >
          <CheckCheck
            className={cn("size-5", dx > 0 ? "text-accent-ink" : "opacity-0")}
            strokeWidth={1.75}
          />
          <Archive
            className={cn(
              "size-5",
              dx < 0 ? "text-text-secondary" : "opacity-0",
            )}
            strokeWidth={1.75}
          />
        </div>
      ) : null}

      <div
        style={dx === 0 ? undefined : { transform: `translateX(${dx}px)` }}
        className={cn(
          "relative bg-surface",
          dx === 0 &&
            "transition-transform duration-(--motion-duration) ease-standard",
        )}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          if (!touch) return;
          origin.current = { x: touch.clientX, y: touch.clientY };
          engaged.current = false;
        }}
        onTouchMove={(event) => {
          const touch = event.touches[0];
          if (!touch || !origin.current) return;
          const moveX = touch.clientX - origin.current.x;
          const moveY = touch.clientY - origin.current.y;
          if (!engaged.current) {
            if (Math.abs(moveX) < 12 || Math.abs(moveX) <= Math.abs(moveY))
              return;
            engaged.current = true;
          }
          setDx(Math.max(-140, Math.min(140, moveX)));
        }}
        onTouchEnd={() => {
          const moved = dx;
          origin.current = null;
          engaged.current = false;
          setDx(0);
          if (moved > SWIPE_THRESHOLD) onRight();
          else if (moved < -SWIPE_THRESHOLD) onLeft();
        }}
      >
        {children}
      </div>
    </div>
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
