"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  ChevronUp,
  Clock,
  ExternalLink,
  Loader2,
  Pause,
  Reply,
  RefreshCw,
  Send,
  Smile,
  Sparkles,
  X,
} from "lucide-react";

import {
  addFaqEntryFromConversation,
  sendManualReply,
  setConversationStatus,
  validateDraft,
  type ModerationResult,
} from "@/app/actions/moderation";
import {
  generateConversationDraft,
  type DraftGenerationResult,
} from "@/app/actions/moderation-draft";
import { CorrectionDialog } from "@/components/moderation/correction-dialog";
import { EmojiPicker } from "@/components/moderation/emoji-picker";
import {
  SaveReplyButton,
  SavedRepliesButton,
} from "@/components/moderation/saved-replies";
import { ParticipantAvatar } from "@/components/moderation/participant-avatar";
import { Button } from "@/components/ui/button";
import {
  evaluateSendEligibility,
  formatWindow,
  windowState,
} from "@/lib/moderation/response-window";
import { ATTACHMENT_LABELS } from "@/lib/moderation/ingest";
import { standingOf } from "@/lib/moderation/confidence";
import { characterLimit } from "@/lib/moderation/limits";
import { isReactionOnly } from "@/lib/moderation/reactions";
import {
  CHANNEL_LABELS,
  FLAG_LABELS,
  KIND_LABELS,
  participantLabel,
  STATUS_LABELS,
  type Conversation,
  type Draft,
  type ModerationMessage,
  type ModerationRole,
  type SavedReply,
} from "@/lib/moderation/types";
import { cn } from "@/lib/utils";

/**
 * Colonne de droite : le fil complet et la zone de réponse.
 *
 * Trois actions sur un brouillon — valider, refuser, ignorer — plus la mise en
 * attente. Chacune a son raccourci ; le refus ouvre systématiquement la box de
 * correction, jamais un simple rejet : c'est la règle qui fait progresser la FAQ.
 */
/** Au-delà, le fil se déroule à la demande. */
const VISIBLE_MESSAGES = 30;

/** Le jour d'un message, à Paris — la journée de travail, pas celle d'UTC. */
function dayKey(iso: string): string {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/**
 * Le séparateur de jour : « Aujourd'hui », « Hier », sinon la date en toutes
 * lettres. Une date brute répétée ne dit rien de plus qu'un trait.
 */
function dayLabel(iso: string): string {
  const key = dayKey(iso);
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());
  if (key === today) return "Aujourd'hui";
  if (key === yesterday) return "Hier";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

export function ConversationThread({
  clientSlug,
  clientName,
  clientLogoUrl,
  role,
  conversation,
  messages,
  draft,
  savedReplies,
  onAdvance,
  onBack,
}: {
  clientSlug: string | null;
  clientName: string | null;
  clientLogoUrl: string | null;
  role: ModerationRole;
  conversation: Conversation | null;
  messages: ModerationMessage[];
  draft: Draft | null;
  /** Toute la bibliothèque : le composeur filtre sur le client du fil. */
  savedReplies: SavedReply[];
  onAdvance: () => void;
  /** Mobile : referme le fil et rend la liste. */
  onBack: () => void;
}) {
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [reply, setReply] = useState("");
  // Le brouillon fraîchement généré prend la main sur celui passé en props :
  // le serveur l'a écrit en base, mais la page n'a pas encore été relue.
  const [generated, setGenerated] = useState<Draft | null>(null);
  const [generating, setGenerating] = useState(false);
  const [failure, setFailure] = useState<{ message: string; retryable: boolean } | null>(
    null,
  );
  const asked = useRef(false);
  /* Lu avant toute sortie anticipée : les effets ne peuvent pas vivre après
     le `return` du fil vide. */
  const lastInboundBody =
    [...messages].reverse().find((message) => message.direction === "inbound")?.body ??
    null;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [replyPending, startReply] = useTransition();
  const replyRef = useRef<HTMLTextAreaElement>(null);

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
  const current = generated ?? draft;

  /**
   * Demande la réponse au modèle. Le résultat est écrit en base par l'action,
   * donc un fil n'est payé qu'une fois : `force` n'est vrai que sur un clic
   * humain de « Régénérer ».
   */
  async function askForDraft(force: boolean) {
    if (!conversation) return;
    // Une réaction ne se répond pas : pas d'appel modèle, donc pas de facture.
    if (isReactionOnly(lastInboundBody)) return;
    setGenerating(true);
    setFailure(null);
    let result: DraftGenerationResult;
    try {
      result = await generateConversationDraft({
        conversationId: conversation.id,
        force,
      });
    } catch (error) {
      result = { ok: false, error: (error as Error).message, cause: "error" };
    }
    setGenerating(false);
    if (result.ok) {
      setGenerated(result.draft);
    } else {
      setFailure({ message: result.error, retryable: result.cause !== "config" });
    }
  }

  // À l'ouverture d'un fil sans brouillon : on en demande un, une seule fois.
  // Le composant est remonté à chaque conversation (`key` côté inbox), donc le
  // garde-fou se réarme tout seul.
  useEffect(() => {
    if (!conversation || draft || !canAct || asked.current) return;
    asked.current = true;
    void askForDraft(false);
    // `askForDraft` est recréée à chaque rendu ; l'inclure relancerait la
    // génération en boucle — et chaque tour est un appel modèle facturé.
    // `lastInboundBody` non plus : il est dérivé du fil, qui ne change pas
    // sans que la conversation change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation, draft, canAct]);

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
      if (key === "v" && current) {
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
      } else if (event.key === "Escape") {
        // Échap referme le fil : on revient à la liste sans viser la croix.
        event.preventDefault();
        onBack();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [conversation, current, canAct, onBack]);

  /* Le fil s'ouvre sur son dernier message, comme toute messagerie. Sans
     ancrage, une conversation longue s'ouvrait en haut et il fallait dérouler
     pour lire ce qui venait d'arriver — c'est-à-dire la seule chose qu'on
     vient lire. `expanded` en dépendance : dérouler les anciens messages
     repose la vue en bas plutôt que de sauter au début. */
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [conversation?.id, messages.length, expanded]);

  /** Met le pseudo de l'auteur dans la zone de saisie et y pose le curseur. */
  function mentionAuthor(handle: string | null) {
    const mention = handle ? `@${handle} ` : "";
    setReply((value) => (value.startsWith(mention) ? value : `${mention}${value}`));
    replyRef.current?.focus();
  }

  function submitReply() {
    if (!conversation || !reply.trim()) return;
    startReply(async () => {
      const result = await sendManualReply({
        conversationId: conversation.id,
        body: reply.trim(),
      });
      if (result.ok) {
        toast.success(result.message);
        setReply("");
      } else {
        toast.error(result.error);
      }
    });
  }

  if (!conversation) {
    return (
      <div className="type-body flex flex-1 items-center justify-center p-8 text-text-secondary">
        Sélectionnez une conversation.
      </div>
    );
  }

  /* Les trente derniers, sauf demande explicite. Un fil de deux cents
     messages ouvrirait l'écran sur une conversation de l'an dernier. */
  const visibleMessages = expanded ? messages : messages.slice(-VISIBLE_MESSAGES);
  const hidden = messages.length - visibleMessages.length;

  const lastInbound = [...messages]
    .reverse()
    .find((message) => message.direction === "inbound");

  const lastInboundAt = new Date(lastInbound?.sent_at ?? conversation.last_message_at);
  const eligibility = evaluateSendEligibility({
    channel: conversation.channel,
    kind: conversation.kind,
    lastInboundAt,
  });
  /* Trois états et pas un de plus : ouverte, se ferme aujourd'hui, expirée.
     Un commentaire public n'en a aucun — afficher « pas de limite » sur chaque
     fil serait du bruit. Expirée, la plateforme refuse l'envoi : les champs se
     verrouillent ici plutôt que de laisser écrire trois lignes pour rien. */
  const limit = characterLimit(conversation.channel, conversation.kind);
  const tooLong = limit !== null && reply.length > limit;

  const replyWindow = windowState({
    channel: conversation.channel,
    kind: conversation.kind,
    lastInboundAt,
  });
  const windowClosed = replyWindow === "expired";

  const standing = standingOf(current);
  const { sources, grounded } = standing;
  /* Sous le seuil, la proposition ne s'affiche pas : un texte plausible à
     20 % de confiance n'aide pas, il se fait valider par réflexe. L'écran
     montre alors ce qui manque — une entrée de FAQ — et le bouton pour
     l'ajouter. Le seuil porte sur la **confiance seule** : beaucoup de
     réponses légitimes n'ont aucune source, un message privé le premier, et
     la consigne est que le modèle propose toujours dans ce cas. */
  const belowThreshold = current !== null && !standing.proposable;

  /* Une réaction — « ❤️ », « @sophie » — ne demande pas de réponse. Aucun
     appel au modèle n'est fait pour elle, et le fil propose de la clore. */
  const reactionOnly = isReactionOnly(lastInbound?.body);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* En-tête du fil */}
      <div className="border-b border-border shrink-0 px-4 py-3.5 md:px-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={onBack}
            className="focus-visible:ring-ring -ml-1 rounded-md p-1 text-text-secondary transition-colors duration-(--motion-duration) ease-standard hover:text-text-primary focus-visible:ring-2 focus-visible:outline-none md:hidden"
            aria-label="Revenir à la liste"
          >
            <ArrowLeft className="size-4.5" strokeWidth={1.75} aria-hidden />
          </button>
          {/* La même vignette que la liste : on sait toujours à qui l'on
              parle, sur quel réseau et chez quel client. */}
          <ParticipantAvatar
            handle={conversation.participant_handle}
            avatarUrl={conversation.participant_avatar_url}
            channel={conversation.channel}
            clientLogoUrl={clientLogoUrl}
            clientName={clientName}
            size="lg"
          />
          <div className="min-w-0">
            <h2 className="type-h3 truncate text-text-primary">
              {participantLabel(conversation.participant_handle)}
            </h2>
            <span className="type-caption text-text-secondary">
              {clientName ? `${clientName} · ` : null}
              {CHANNEL_LABELS[conversation.channel]} ·{" "}
              {KIND_LABELS[conversation.kind]} ·{" "}
              {STATUS_LABELS[conversation.status]}
            </span>
          </div>
          {replyWindow === "none" ? null : (
            <span
              className={cn(
                "type-caption rounded-pill ml-auto inline-flex items-center gap-1 px-2 py-0.5 font-medium",
                replyWindow === "open" && "text-text-secondary",
                replyWindow === "closing" && "bg-warning-subtle text-warning-ink",
                windowClosed && "bg-danger-subtle text-danger-ink",
              )}
            >
              <Clock className="size-3.5" aria-hidden />
              {formatWindow(eligibility)}
            </span>
          )}
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
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {hidden > 0 ? (
          /* Les anciens messages ne se chargent pas tout seuls : un fil de
             deux cents messages ouvrirait l'écran sur une conversation de
             l'an dernier, et il faudrait dérouler pour trouver ce qui vient
             d'arriver. */
          <div className="flex justify-center">
            <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(true)}>
              <ChevronUp className="size-4" strokeWidth={1.75} aria-hidden />
              {hidden === 1
                ? "Voir le message précédent"
                : `Voir les ${hidden} messages précédents`}
            </Button>
          </div>
        ) : null}

        {visibleMessages.map((message, index) => {
          const previous = visibleMessages[index - 1];
          const newDay = !previous || dayKey(previous.sent_at) !== dayKey(message.sent_at);

          return (
            <div key={message.id} className="space-y-3">
              {newDay ? (
                /* Un séparateur de jour, pas une date par bulle : sur un fil
                   d'une semaine, la même date répétée trente fois se lit comme
                   du bruit, et on ne voit plus où la journée commence. */
                <p className="type-micro text-text-secondary flex items-center gap-3 py-1">
                  <span aria-hidden className="h-px flex-1 bg-border" />
                  {dayLabel(message.sent_at)}
                  <span aria-hidden className="h-px flex-1 bg-border" />
                </p>
              ) : null}

              <div
                className={cn(
                  "group/message type-body max-w-[75%] rounded-lg px-3 py-2",
                  message.direction === "inbound"
                    ? "bg-card"
                    : "bg-brand-mint text-heading ml-auto",
                )}
              >
                {message.body ? (
                  <p className="whitespace-pre-wrap">{message.body}</p>
                ) : null}

                <MessageAttachments attachments={message.attachments} />

                <div className="mt-1 flex items-center gap-2">
                  <p className="text-muted-foreground type-micro">
                    {new Intl.DateTimeFormat("fr-FR", {
                      timeStyle: "short",
                      timeZone: "Europe/Paris",
                    }).format(new Date(message.sent_at))}
                    {message.origin === "platform" && message.direction === "outbound"
                      ? " · envoyé hors outil"
                      : null}
                  </p>

                  {canAct && message.direction === "inbound" ? (
                    // Répondre **à ce message** : le pseudo part dans la zone
                    // de saisie, mention comprise. Une conversation à trois
                    // voix se répond en nommant celui à qui on parle.
                    <button
                      type="button"
                      onClick={() => mentionAuthor(message.author_handle)}
                      className="focus-visible:ring-ring text-muted-foreground hover:text-accent-ink type-micro inline-flex items-center gap-1 rounded-sm opacity-0 transition-opacity duration-(--motion-duration) ease-standard group-hover/message:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <Reply className="size-3" strokeWidth={1.75} aria-hidden />
                      Répondre
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Zone de réponse.

          `shrink-0` : c'est le fil au-dessus qui se comprime, jamais elle —
          sans ça, une réponse longue poussait les boutons de validation hors
          de l'écran et il n'y avait plus aucun moyen de valider quoi que ce
          soit. Et la réponse elle-même défile dans sa boîte : une proposition
          de quinze lignes ne doit pas repousser ce qui permet de l'accepter. */}
      <div className="border-border shrink-0 border-t px-5 py-4">
        {reactionOnly ? (
          /* Une réaction : rien à rédiger, rien à valider. Un bouton la clôt,
             et c'est aussi ce que fait le groupe « Réactions » de la liste. */
          <form action={statusAction}>
            <HiddenFields
              clientId={conversation.client_id}
              conversationId={conversation.id}
              clientSlug={clientSlug ?? ""}
            />
            <input type="hidden" name="status" value="answered_elsewhere" />
            <div className="border-border flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-4">
              <Smile
                className="text-text-tertiary size-5 shrink-0"
                strokeWidth={1.75}
                aria-hidden
              />
              <p className="type-body min-w-0 flex-1 text-text-secondary">
                Une réaction, pas une question. Aucune réponse n&apos;a été
                demandée au modèle.
              </p>
              {canAct ? (
                <Button type="submit" size="sm" disabled={changingStatus}>
                  <Check className="size-4" strokeWidth={1.75} aria-hidden />
                  Clore sans réponse
                </Button>
              ) : null}
            </div>
          </form>
        ) : belowThreshold ? (
          <FaqGapCard
            clientId={conversation.client_id}
            clientName={clientName}
            question={lastInbound?.body ?? ""}
            canAct={canAct}
          />
        ) : current ? (
          <>
            <div className="bg-card max-h-44 overflow-y-auto rounded-lg p-3">
              <p className="type-body whitespace-pre-wrap">{current.body}</p>
            </div>

            <div className="text-muted-foreground type-caption mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                Confiance{" "}
                <span className="text-foreground font-semibold tabular-nums">
                  {current.confidence === null
                    ? "—"
                    : `${Math.round(current.confidence * 100)} %`}
                </span>
              </span>
              <span>Langue détectée : {current.locale.toUpperCase()}</span>
              {current.translated_from_fr ? (
                <span className="text-danger-ink">
                  Traduit depuis le français — réponse EN absente de la FAQ
                </span>
              ) : null}
              {canAct ? (
                <button
                  type="button"
                  onClick={() => void askForDraft(true)}
                  disabled={generating}
                  /* La taille se repose sur le bouton : un contrôle de
                     formulaire n'hérite pas de la casse ni de la graisse de
                     son conteneur. */
                  className="focus-visible:ring-ring type-caption ml-auto inline-flex items-center gap-1 rounded-sm text-accent-ink transition-colors duration-(--motion-duration) ease-standard hover:underline focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                >
                  <RefreshCw
                    className={cn("size-3.5", generating && "animate-spin")}
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  {generating ? "Génération…" : "Régénérer"}
                </button>
              ) : null}
            </div>

            {grounded ? (
              <div className="mt-2">
                <p className="text-muted-foreground type-caption">
                  Sources FAQ utilisées :
                </p>
                <ul className="mt-1 space-y-0.5">
                  {sources.map((source) => (
                    <li key={source.faq_entry_id}>
                      {clientSlug ? (
                        <a
                          href={`/inbox/${clientSlug}/faq?entree=${source.faq_entry_id}`}
                          className="type-caption text-accent-ink underline-offset-2 hover:underline"
                        >
                          {source.question}
                        </a>
                      ) : (
                        <span className="type-caption text-text-secondary">
                          {source.question}
                        </span>
                      )}
                      <span className="text-muted-foreground type-micro ml-2 tabular-nums">
                        {Math.round(source.similarity * 100)} %
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              /* Sans entrée citée, ce n'est pas une citation de la FAQ mais une
                 proposition : elle se relit mot à mot avant de partir. */
              <p className="type-caption mt-2 inline-flex items-center gap-1.5 text-warning-ink">
                <Sparkles className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                Proposition sans source FAQ
              </p>
            )}
          </>
        ) : generating ? (
          <div className="border-border type-body flex items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-text-secondary">
            <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden />
            Rédaction de la réponse…
          </div>
        ) : failure ? (
          <div className="border-border rounded-lg border border-dashed p-4 text-center">
            <p className="type-label text-danger-ink">{failure.message}</p>
            <p className="text-muted-foreground type-caption mt-1">
              Écrivez la réponse à la main ci-dessous.
            </p>
            {failure.retryable && canAct ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => void askForDraft(true)}
              >
                <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
                Réessayer
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="border-border type-body rounded-lg border border-dashed p-4 text-center text-text-secondary">
            Aucune réponse proposée pour l&apos;instant.
          </div>
        )}

        {canAct && !reactionOnly ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {current && !belowThreshold ? (
              <form action={validateAction}>
                <HiddenFields
                  clientId={conversation.client_id}
                  conversationId={conversation.id}
                  clientSlug={clientSlug ?? ""}
                />
                <Button
                  id="draft-validate"
                  type="submit"
                  disabled={validating || windowClosed}
                  title={
                    windowClosed
                      ? "La plateforme n'accepte plus de réponse sur ce fil."
                      : undefined
                  }
                >
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
          <p className="text-muted-foreground type-caption mt-3">
            Votre rôle est en lecture seule sur cet espace.
          </p>
        )}

        {canAct ? (
          <div className="mt-3 border-t border-border pt-3">
            <label htmlFor="reponse-libre" className="sr-only">
              Réponse écrite à la main
            </label>
            <textarea
              id="reponse-libre"
              ref={replyRef}
              value={reply}
              disabled={windowClosed}
              onChange={(event) => setReply(event.target.value)}
              onKeyDown={(event) => {
                // ⌘/Ctrl + Entrée envoie : la touche Entrée seule doit garder
                // le retour à la ligne, on écrit parfois trois phrases.
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  submitReply();
                }
              }}
              rows={2}
              placeholder={
                windowClosed
                  ? "Fenêtre de réponse fermée."
                  : "Écrire une réponse…"
              }
              className="focus-visible:ring-ring type-body w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-text-primary placeholder:text-text-secondary focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-surface-sunken"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <SavedRepliesButton
                clientId={conversation.client_id}
                kind={conversation.kind}
                replies={savedReplies}
                onInsert={(body) => {
                  setReply((current) => (current.trim() ? `${current}\n${body}` : body));
                  replyRef.current?.focus();
                }}
              />
              <SaveReplyButton
                clientId={conversation.client_id}
                kind={conversation.kind}
                body={reply}
              />
              <EmojiPicker
                onPick={(emoji) => {
                  setReply((current) => current + emoji);
                  replyRef.current?.focus();
                }}
              />
              {/* Pas de bouton de pièce jointe : `sendReply` ne poste que du
                  texte sur les trois canaux branchés. Un bouton grisé
                  promettrait une fonctionnalité qui n'existe pas, et on
                  cliquerait dessus toutes les semaines en croyant à une
                  panne (`acceptsAttachments`). */}
              {limit !== null ? (
                <span
                  className={cn(
                    "type-caption tabular-nums",
                    tooLong ? "text-danger-ink font-medium" : "text-text-secondary",
                  )}
                >
                  {reply.length} / {limit}
                </span>
              ) : null}
              <p className="type-caption ml-auto text-text-secondary">
                {windowClosed
                  ? "Sept jours après le dernier message, Meta refuse toute réponse. Rien ne partira d'ici."
                  : conversation.kind === "dm"
                    ? "Part en message privé, sans passer par la FAQ."
                    : "Part sous le commentaire, sans passer par la FAQ."}
              </p>
              <Button
                type="button"
                size="sm"
                className="shrink-0"
                onClick={submitReply}
                disabled={
                  replyPending || windowClosed || tooLong || reply.trim().length === 0
                }
              >
                <Send className="size-4" strokeWidth={1.75} aria-hidden />
                {replyPending ? "Envoi…" : "Envoyer"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <CorrectionDialog
        open={correctionOpen}
        onOpenChange={setCorrectionOpen}
        clientId={conversation.client_id}
        clientSlug={clientSlug ?? ""}
        conversationId={conversation.id}
        incomingMessage={lastInbound?.body ?? ""}
        draftBody={current?.body ?? ""}
        locale={current?.locale ?? conversation.detected_locale ?? "fr"}
        sources={sources}
        onDone={onAdvance}
      />
    </div>
  );
}

/**
 * Ce qui s'affiche à la place d'une proposition trop incertaine.
 *
 * Pas « aucune réponse disponible » — c'est la formule qu'on s'est interdite,
 * elle laisse l'opérateur devant un écran vide. On nomme ce qui manque, la
 * FAQ du client, et on met le geste à portée : la question telle qu'elle est
 * arrivée, la réponse à écrire une fois, et le prochain message du même genre
 * trouvera son entrée.
 */
function FaqGapCard({
  clientId,
  clientName,
  question,
  canAct,
}: {
  clientId: string;
  clientName: string | null;
  question: string;
  canAct: boolean;
}) {
  const [answer, setAnswer] = useState("");
  const [saving, startSaving] = useTransition();

  return (
    <div className="border-border rounded-lg border border-dashed p-4">
      <p className="type-label inline-flex items-center gap-1.5 text-warning-ink">
        <BookOpen className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
        Aucune source FAQ pour ce sujet
      </p>
      <p className="type-caption mt-1 text-text-secondary">
        Le modèle n&apos;a rien trouvé d&apos;assez sûr. Écrivez la réponse une
        fois : elle rejoint la FAQ{clientName ? ` de ${clientName}` : ""} et
        servira la prochaine fois.
      </p>

      {canAct ? (
        <>
          <textarea
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            rows={3}
            aria-label="Réponse à ajouter à la FAQ"
            placeholder="La réponse de référence…"
            className="focus-visible:ring-ring type-body mt-2 w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-text-primary placeholder:text-text-secondary focus-visible:ring-2 focus-visible:outline-none"
          />
          <Button
            type="button"
            size="sm"
            className="mt-2"
            disabled={saving || answer.trim().length < 3 || question.trim().length < 3}
            onClick={() =>
              startSaving(async () => {
                const result = await addFaqEntryFromConversation({
                  clientId,
                  question,
                  answer,
                });
                if (result.ok) {
                  toast.success(result.message);
                  setAnswer("");
                } else {
                  toast.error(result.error);
                }
              })
            }
          >
            <BookOpen className="size-4" strokeWidth={1.75} aria-hidden />
            {saving ? "Ajout…" : `Ajouter à la FAQ${clientName ? ` ${clientName}` : ""}`}
          </Button>
        </>
      ) : null}
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

/**
 * Les pièces jointes d'un message — un GIF, une image, un sticker.
 *
 * Sur Facebook, une réponse en GIF est un commentaire au texte vide : sans ce
 * rendu, la bulle s'affichait blanche et on croyait à un message perdu. Le
 * lien d'origine reste ouvrable, la vignette n'étant qu'une image figée chez
 * Meta pour certains types.
 */
function MessageAttachments({
  attachments,
}: {
  attachments: ModerationMessage["attachments"];
}) {
  const items = (attachments ?? []) as {
    type?: string;
    url?: string | null;
    href?: string | null;
    title?: string | null;
  }[];
  if (items.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-2">
      {items.map((attachment, index) => {
        const label =
          attachment.title ??
          ATTACHMENT_LABELS[attachment.type ?? ""] ??
          "Pièce jointe";

        if (!attachment.url) {
          return attachment.href ? (
            <a
              key={index}
              href={attachment.href}
              target="_blank"
              rel="noreferrer"
              className="type-caption text-accent-ink underline-offset-2 hover:underline"
            >
              {label}
            </a>
          ) : null;
        }

        return (
          <AttachmentImage
            key={index}
            src={attachment.url}
            href={attachment.href ?? null}
            label={label}
          />
        );
      })}
    </div>
  );
}

/**
 * Une pièce jointe en image, avec repli sur son libellé.
 *
 * Les URL de médias de Meta expirent : une vignette morte affichait l'icône
 * d'image cassée du navigateur, qui se lit comme une panne du produit. Quand
 * l'image ne charge pas, on rend le nom de la pièce jointe — cliquable si on
 * a son lien d'origine, qui lui ne périme pas.
 */
function AttachmentImage({
  src,
  href,
  label,
}: {
  src: string;
  href: string | null;
  label: string;
}) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return href ? (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="type-caption text-accent-ink underline-offset-2 hover:underline"
      >
        {label}
      </a>
    ) : (
      <span className="type-caption text-text-secondary">{label} indisponible</span>
    );
  }

  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- CDN Meta
    <img
      src={src}
      alt={label}
      onError={() => setBroken(true)}
      className="max-h-48 rounded-md border border-border object-contain"
    />
  );

  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="focus-visible:ring-ring rounded-md focus-visible:ring-2 focus-visible:outline-none"
    >
      {image}
    </a>
  ) : (
    image
  );
}
