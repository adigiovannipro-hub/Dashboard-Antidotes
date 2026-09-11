"use client";

import { useMemo, useState, useTransition } from "react";
import { BookmarkPlus, Library, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createSavedReply,
  deleteSavedReply,
  noteSavedReplyUse,
} from "@/app/actions/moderation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  KIND_LABELS,
  savedReplyApplies,
  savedReplyMatches,
  type ConversationKind,
  type SavedReply,
} from "@/lib/moderation/types";
import { cn } from "@/lib/utils";

/**
 * La bibliothèque de réponses enregistrées, ouverte depuis le composeur.
 *
 * Le mot d'accueil d'un message privé, le lien vers le suivi de commande, la
 * phrase qui redirige vers le SAV : on les retape dix fois par semaine. Ici
 * on les cherche et on les colle ; là-bas, un bouton enregistre celle qu'on
 * vient d'écrire, au moment où l'on s'aperçoit qu'on la réécrit.
 *
 * La liste est filtrée sur le **type de fil** : proposer un mot d'accueil de
 * message privé sous un commentaire public fait perdre le temps qu'on croyait
 * gagner.
 */
export function SavedRepliesButton({
  clientId,
  kind,
  replies,
  onInsert,
}: {
  clientId: string;
  kind: ConversationKind;
  replies: SavedReply[];
  onInsert: (body: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [, startUse] = useTransition();
  const [removing, startRemoving] = useTransition();

  const available = useMemo(
    () =>
      replies
        .filter((reply) => reply.client_id === clientId)
        .filter((reply) => savedReplyApplies(reply, kind))
        .filter((reply) => savedReplyMatches(reply, query)),
    [replies, clientId, kind, query],
  );

  const ofClient = replies.filter((reply) => reply.client_id === clientId).length;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        title="Réponses enregistrées"
      >
        <Library className="size-4" strokeWidth={1.75} aria-hidden />
        Réponses
        {ofClient > 0 ? <span className="tabular-nums">{ofClient}</span> : null}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Réponses enregistrées</DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-tertiary"
              aria-hidden
            />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Chercher un nom, un mot, une étiquette"
              aria-label="Chercher une réponse enregistrée"
              className="pl-9"
            />
          </div>

          {available.length === 0 ? (
            <p className="type-body py-6 text-center text-text-secondary">
              {ofClient === 0
                ? "Aucune réponse enregistrée pour ce client. Écrivez-en une, puis « Enregistrer »."
                : "Rien ne correspond, ou rien ne sert ce type de fil."}
            </p>
          ) : (
            <ul className="max-h-80 space-y-1 overflow-y-auto">
              {available.map((reply) => (
                <li key={reply.id} className="flex items-start gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      onInsert(reply.body);
                      setOpen(false);
                      startUse(async () => {
                        await noteSavedReplyUse({ clientId, replyId: reply.id });
                      });
                    }}
                    className="focus-visible:ring-ring min-w-0 flex-1 rounded-md px-2 py-1.5 text-left transition-colors duration-(--motion-duration) ease-standard hover:bg-surface-sunken focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <span className="type-label flex flex-wrap items-baseline gap-2">
                      {reply.title}
                      {reply.tags.map((tag) => (
                        <span
                          key={tag}
                          className="type-micro rounded-pill border border-border px-1.5 text-text-secondary"
                        >
                          {tag}
                        </span>
                      ))}
                      {reply.scope.length > 0 ? (
                        <span className="type-micro text-text-secondary">
                          {reply.scope.map((entry) => KIND_LABELS[entry]).join(" · ")}
                        </span>
                      ) : null}
                    </span>
                    <span className="type-caption mt-0.5 line-clamp-2 block text-text-secondary">
                      {reply.body}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={removing}
                    aria-label={`Retirer ${reply.title}`}
                    onClick={() =>
                      startRemoving(async () => {
                        const result = await deleteSavedReply({
                          clientId,
                          replyId: reply.id,
                        });
                        if (result.ok) toast.success(result.message);
                        else toast.error(result.error);
                      })
                    }
                    className="focus-visible:ring-ring mt-1 flex size-7 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors duration-(--motion-duration) ease-standard hover:bg-danger-subtle hover:text-danger-ink focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * « Enregistrer » : garde la réponse qu'on vient d'écrire.
 *
 * Le nom est demandé, le reste a des défauts sensés — aucune étiquette, et la
 * portée du fil courant, parce que c'est presque toujours celle qu'on veut.
 */
export function SaveReplyButton({
  clientId,
  kind,
  body,
}: {
  clientId: string;
  kind: ConversationKind;
  body: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [everywhere, setEverywhere] = useState(false);
  const [saving, startSaving] = useTransition();

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={body.trim().length < 2}
        onClick={() => setOpen(true)}
        title="Enregistrer cette réponse"
      >
        <BookmarkPlus className="size-4" strokeWidth={1.75} aria-hidden />
        Enregistrer
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enregistrer cette réponse</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label htmlFor="reponse-nom" className="type-caption text-text-secondary">
                Nom
              </label>
              <Input
                id="reponse-nom"
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Accueil message privé"
                className="mt-1"
              />
            </div>

            <div>
              <label htmlFor="reponse-tags" className="type-caption text-text-secondary">
                Étiquettes, séparées par des virgules
              </label>
              <Input
                id="reponse-tags"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="SAV, livraison"
                className="mt-1"
              />
            </div>

            <label className="type-caption flex items-center gap-2 text-text-secondary">
              <input
                type="checkbox"
                checked={everywhere}
                onChange={(event) => setEverywhere(event.target.checked)}
                className="focus-visible:ring-ring size-4 rounded-sm border-border accent-[var(--accent-ink)] focus-visible:ring-2 focus-visible:outline-none"
              />
              La proposer sur tous les types de fil, pas seulement les{" "}
              {KIND_LABELS[kind].toLowerCase()}s
            </label>

            <p className={cn("type-caption rounded-md bg-surface-sunken p-2 text-text-secondary")}>
              {body.trim().slice(0, 220)}
              {body.trim().length > 220 ? "…" : ""}
            </p>

            <Button
              type="button"
              disabled={saving || title.trim().length < 2}
              onClick={() =>
                startSaving(async () => {
                  const result = await createSavedReply({
                    clientId,
                    title,
                    body,
                    tags: tags
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                    scope: everywhere ? [] : [kind],
                  });
                  if (result.ok) {
                    toast.success(result.message);
                    setTitle("");
                    setTags("");
                    setOpen(false);
                  } else {
                    toast.error(result.error);
                  }
                })
              }
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
