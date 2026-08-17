"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock,
  ExternalLink,
  Pause,
  X,
} from "lucide-react";

import {
  setConversationStatus,
  validateDraft,
  type ModerationResult,
} from "@/app/actions/moderation";
import { CorrectionDialog } from "@/components/moderation/correction-dialog";
import { Button } from "@/components/ui/button";
import {
  evaluateSendEligibility,
  formatWindow,
} from "@/lib/moderation/response-window";
import {
  CHANNEL_LABELS,
  FLAG_LABELS,
  KIND_LABELS,
  STATUS_LABELS,
  type Conversation,
  type Draft,
  type DraftSource,
  type ModerationMessage,
  type ModerationRole,
} from "@/lib/moderation/types";
import { cn } from "@/lib/utils";

/**
 * Colonne de droite : le fil complet et la zone de réponse.
 *
 * Trois actions sur un brouillon — valider, refuser, ignorer — plus la mise en
 * attente. Chacune a son raccourci ; le refus ouvre systématiquement la box de
 * correction, jamais un simple rejet : c'est la règle qui fait progresser la FAQ.
 */
export function ConversationThread({
  clientSlug,
  clientName,
  role,
  conversation,
  messages,
  draft,
  onAdvance,
  onBack,
}: {
  clientSlug: string | null;
  clientName: string | null;
  role: ModerationRole;
  conversation: Conversation | null;
  messages: ModerationMessage[];
  draft: Draft | null;
  onAdvance: () => void;
  /** Mobile : referme le fil et rend la liste. */
  onBack: () => void;
}) {
  const [correctionOpen, setCorrectionOpen] = useState(false);

  const [validateState, validateAction, validating] = useActionState<
    ModerationResult | null,
    FormData
  >(validateDraft, null);
  const [statusState, statusAction, changingStatus] = useActionState<
    ModerationResult | null,
    FormData
  >(setConversationStatus, null);

  useEffect(() => {
    const state = validateState ?? statusState;
    if (!state) return;
    if (state.ok) {
      toast.success(state.message);
      onAdvance();
    } else {
      toast.error(state.error);
    }
    // `onAdvance` change à chaque rendu du parent ; l'inclure relancerait le
    // toast en boucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validateState, statusState]);

  const canAct = role === "owner" || role === "operator";

  useEffect(() => {
    if (!conversation || !canAct) return;

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "v" && draft) {
        event.preventDefault();
        document.getElementById("draft-validate")?.click();
      } else if (key === "r") {
        event.preventDefault();
        setCorrectionOpen(true);
      } else if (key === "i") {
        event.preventDefault();
        document.getElementById("conversation-ignore")?.click();
      } else if (key === "a") {
        event.preventDefault();
        document.getElementById("conversation-snooze")?.click();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [conversation, draft, canAct]);

  if (!conversation) {
    return (
      <div className="type-body flex flex-1 items-center justify-center p-8 text-text-secondary">
        Sélectionnez une conversation.
      </div>
    );
  }

  const lastInbound = [...messages]
    .reverse()
    .find((message) => message.direction === "inbound");

  const eligibility = evaluateSendEligibility({
    channel: conversation.channel,
    kind: conversation.kind,
    lastInboundAt: new Date(lastInbound?.sent_at ?? conversation.last_message_at),
  });

  const sources = (draft?.sources ?? []) as DraftSource[];

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* En-tête du fil */}
      <div className="border-b border-border px-4 py-3.5 md:px-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={onBack}
            className="focus-visible:ring-ring -ml-1 rounded-md p-1 text-text-secondary transition-colors duration-(--motion-duration) ease-standard hover:text-text-primary focus-visible:ring-2 focus-visible:outline-none md:hidden"
            aria-label="Revenir à la liste"
          >
            <ArrowLeft className="size-4.5" strokeWidth={1.75} aria-hidden />
          </button>
          <h2 className="type-h3 text-text-primary">
            {conversation.participant_handle ?? "Inconnu"}
          </h2>
          <span className="type-caption text-text-secondary">
            {clientName ? `${clientName} · ` : null}
            {CHANNEL_LABELS[conversation.channel]} ·{" "}
            {KIND_LABELS[conversation.kind]} ·{" "}
            {STATUS_LABELS[conversation.status]}
          </span>
          <span
            className={cn(
              "type-caption ml-auto inline-flex items-center gap-1",
              eligibility.canSend ? "text-text-secondary" : "text-danger-ink",
            )}
          >
            <Clock className="size-3.5" aria-hidden />
            {formatWindow(eligibility)}
          </span>
        </div>

        {conversation.flags.length > 0 ? (
          <p className="type-caption mt-2 inline-flex items-center gap-1.5 rounded-md bg-danger-subtle px-2.5 py-1.5 font-medium text-danger-ink">
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
            {conversation.flags.map((flag) => FLAG_LABELS[flag]).join(" · ")} —
            lecture humaine obligatoire, jamais d&apos;envoi automatique.
          </p>
        ) : null}
      </div>

      {/* La publication commentée : un commentaire ne se modère pas sans elle. */}
      {conversation.post_external_id ? (
        <a
          href={conversation.post_permalink ?? undefined}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "focus-visible:ring-ring flex items-center gap-3 border-b border-border bg-surface-sunken px-4 py-2.5 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none md:px-5",
            conversation.post_permalink
              ? "transition-colors duration-(--motion-duration) ease-standard hover:bg-surface-sunken/60"
              : "pointer-events-none",
          )}
        >
          {conversation.post_thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- CDN Meta
            <img
              src={conversation.post_thumbnail_url}
              alt=""
              className="size-9 shrink-0 rounded-md object-cover"
            />
          ) : null}
          <p className="type-caption min-w-0 flex-1 truncate text-text-secondary">
            {conversation.post_excerpt ?? "Publication sans texte"}
          </p>
          {conversation.post_permalink ? (
            <span className="type-caption inline-flex shrink-0 items-center gap-1 font-medium text-accent-ink">
              Ouvrir la publication
              <ExternalLink className="size-3.5" strokeWidth={1.75} aria-hidden />
            </span>
          ) : null}
        </a>
      ) : null}

      {/* Fil de conversation */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "max-w-[75%] rounded-lg px-3 py-2 text-sm",
              message.direction === "inbound"
                ? "bg-card"
                : "bg-brand-mint text-heading ml-auto",
            )}
          >
            <p className="whitespace-pre-wrap">{message.body}</p>
            <p className="text-muted-foreground mt-1 text-[11px]">
              {new Intl.DateTimeFormat("fr-FR", {
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(message.sent_at))}
              {message.origin === "platform" && message.direction === "outbound"
                ? " · envoyé hors outil"
                : null}
            </p>
          </div>
        ))}
      </div>

      {/* Zone de réponse */}
      <div className="border-border border-t px-5 py-4">
        {draft ? (
          <>
            <div className="bg-card rounded-lg p-3">
              <p className="text-sm whitespace-pre-wrap">{draft.body}</p>
            </div>

            <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span>
                Confiance{" "}
                <span className="text-foreground font-semibold tabular-nums">
                  {draft.confidence === null
                    ? "—"
                    : `${Math.round(draft.confidence * 100)} %`}
                </span>
              </span>
              <span>Langue détectée : {draft.locale.toUpperCase()}</span>
              {draft.translated_from_fr ? (
                <span className="text-danger-ink">
                  Traduit depuis le français — réponse EN absente de la FAQ
                </span>
              ) : null}
            </div>

            {sources.length > 0 ? (
              <div className="mt-2">
                <p className="text-muted-foreground text-xs">Sources FAQ utilisées :</p>
                <ul className="mt-1 space-y-0.5">
                  {sources.map((source) => (
                    <li key={source.faq_entry_id}>
                      {clientSlug ? (
                        <a
                          href={`/moderation/${clientSlug}/faq?entree=${source.faq_entry_id}`}
                          className="type-caption text-accent-ink underline-offset-2 hover:underline"
                        >
                          {source.question}
                        </a>
                      ) : (
                        <span className="type-caption text-text-secondary">
                          {source.question}
                        </span>
                      )}
                      <span className="text-muted-foreground ml-2 text-[11px] tabular-nums">
                        {Math.round(source.similarity * 100)} %
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : (
          <div className="border-border rounded-lg border border-dashed p-4 text-center">
            <p className="text-sm font-medium">Sans réponse disponible</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {conversation.flags.length > 0
                ? "Message signalé : aucun brouillon n'est généré, la réponse doit être écrite à la main."
                : "Aucune entrée FAQ ne couvre cette demande avec assez de certitude."}
            </p>
          </div>
        )}

        {canAct ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {draft ? (
              <form action={validateAction}>
                <HiddenFields
                  clientId={conversation.client_id}
                  conversationId={conversation.id}
                  clientSlug={clientSlug ?? ""}
                />
                <Button id="draft-validate" type="submit" disabled={validating}>
                  <Check className="size-4" aria-hidden />
                  Valider <Kbd>V</Kbd>
                </Button>
              </form>
            ) : null}

            <Button
              type="button"
              variant="outline"
              onClick={() => setCorrectionOpen(true)}
            >
              <X className="size-4" aria-hidden />
              Refuser et corriger <Kbd>R</Kbd>
            </Button>

            <form action={statusAction}>
              <HiddenFields
                clientId={conversation.client_id}
                conversationId={conversation.id}
                clientSlug={clientSlug ?? ""}
              />
              <input type="hidden" name="status" value="snoozed" />
              <Button
                id="conversation-snooze"
                type="submit"
                variant="ghost"
                disabled={changingStatus}
              >
                <Pause className="size-4" aria-hidden />
                En attente <Kbd>A</Kbd>
              </Button>
            </form>

            <form action={statusAction}>
              <HiddenFields
                clientId={conversation.client_id}
                conversationId={conversation.id}
                clientSlug={clientSlug ?? ""}
              />
              <input type="hidden" name="status" value="ignored" />
              <Button
                id="conversation-ignore"
                type="submit"
                variant="ghost"
                disabled={changingStatus}
              >
                Ignorer <Kbd>I</Kbd>
              </Button>
            </form>
          </div>
        ) : (
          <p className="text-muted-foreground mt-3 text-xs">
            Votre rôle est en lecture seule sur cet espace.
          </p>
        )}
      </div>

      <CorrectionDialog
        open={correctionOpen}
        onOpenChange={setCorrectionOpen}
        clientId={conversation.client_id}
        clientSlug={clientSlug ?? ""}
        conversationId={conversation.id}
        incomingMessage={lastInbound?.body ?? ""}
        draftBody={draft?.body ?? ""}
        locale={draft?.locale ?? conversation.detected_locale ?? "fr"}
        sources={sources}
        onDone={onAdvance}
      />
    </div>
  );
}

function HiddenFields({
  clientId,
  conversationId,
  clientSlug,
}: {
  clientId: string;
  conversationId: string;
  clientSlug: string;
}) {
  return (
    <>
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="conversationId" value={conversationId} />
      <input type="hidden" name="clientSlug" value={clientSlug} />
    </>
  );
}

/**
 * Le raccourci clavier d'un bouton.
 *
 * `currentColor` à 20 % pour le fond : la lettre garde l'encre du bouton qui
 * la porte, donc son contraste, qu'elle soit posée sur l'encre pleine du
 * bouton principal ou sur une surface claire.
 */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="ml-1 rounded-sm bg-current/20 px-1 font-mono text-[10px] leading-none">
      {children}
    </kbd>
  );
}
