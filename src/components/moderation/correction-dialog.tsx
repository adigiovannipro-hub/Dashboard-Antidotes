"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { submitCorrection, type ModerationResult } from "@/app/actions/moderation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DraftSource, SupportedLocale } from "@/lib/moderation/types";
import { proposeCanonical } from "./canonical";

/**
 * Box de correction.
 *
 * Elle s'ouvre à chaque refus, jamais autrement. La case « mettre à jour la
 * FAQ » est cochée par défaut : si l'enrichissement était optionnel et décoché,
 * il n'arriverait jamais et l'outil ne s'améliorerait pas.
 *
 * Quand le brouillon refusé citait une entrée FAQ, l'enrichissement de cette
 * entrée est proposé plutôt que la création d'une nouvelle — une FAQ qui
 * accumule quatre entrées disant la même chose devient pire qu'une FAQ courte.
 */
export function CorrectionDialog({
  open,
  onOpenChange,
  clientId,
  clientSlug,
  conversationId,
  incomingMessage,
  draftBody,
  locale,
  sources,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientSlug: string;
  conversationId: string;
  incomingMessage: string;
  draftBody: string;
  locale: SupportedLocale;
  sources: DraftSource[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ModerationResult | null, FormData>(
    submitCorrection,
    null,
  );

  // La question canonique est préremplie avec une reformulation de la demande :
  // l'opérateur corrige plutôt qu'il ne rédige, ce qui change tout sur cent
  // messages.
  const [question, setQuestion] = useState(() => proposeCanonical(incomingMessage));
  const [answer, setAnswer] = useState(draftBody);
  const [enrichId, setEnrichId] = useState(sources[0]?.faq_entry_id ?? "");

  // Pas d'effet de réinitialisation : le fil de conversation est monté avec une
  // `key` sur l'identifiant, donc changer de conversation remonte ce composant
  // et rejoue les initialisations d'état ci-dessus.

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message);
      onOpenChange(false);
      onDone();
    } else {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Corriger et enrichir la FAQ</DialogTitle>
          <DialogDescription>
            La réponse corrigée part au client, et la FAQ apprend la formulation
            réelle de la demande.
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="space-y-4">
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="clientSlug" value={clientSlug} />
          <input type="hidden" name="conversationId" value={conversationId} />
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="originalQuestion" value={incomingMessage} />

          <div>
            <p className="text-muted-foreground text-xs">Message entrant</p>
            <p className="bg-card mt-1 rounded-md p-2.5 text-sm whitespace-pre-wrap">
              {incomingMessage || "(vide)"}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="correction-answer">
              Élément de langage — la réponse de référence
            </Label>
            <textarea
              id="correction-answer"
              name="correctedBody"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              rows={4}
              required
              className="border-input bg-background focus-visible:ring-brand w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="correction-question">Question canonique</Label>
            <Input
              id="correction-question"
              name="questionCanonical"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="updateFaq"
                defaultChecked
                className="accent-brand mt-0.5"
              />
              <span>
                Mettre à jour la FAQ
                <span className="text-muted-foreground block text-xs">
                  Décoché, la réponse part au client sans que la base apprenne quoi
                  que ce soit.
                </span>
              </span>
            </label>

            {sources.length > 0 ? (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(enrichId)}
                  onChange={(event) =>
                    setEnrichId(event.target.checked ? sources[0]!.faq_entry_id : "")
                  }
                  className="accent-brand mt-0.5"
                />
                <span>
                  Enrichir l&apos;entrée existante plutôt qu&apos;en créer une
                  nouvelle
                  <span className="text-muted-foreground block text-xs">
                    Doublon probable : « {sources[0]!.question} » (
                    {Math.round(sources[0]!.similarity * 100)} % de proximité)
                  </span>
                </span>
              </label>
            ) : null}
            <input type="hidden" name="enrichEntryId" value={enrichId} />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Enregistrement…" : "Corriger et envoyer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

