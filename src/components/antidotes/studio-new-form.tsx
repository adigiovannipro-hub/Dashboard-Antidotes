"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { createDraft, type InboundResult } from "@/app/actions/antidotes-inbound";
import { TextArea } from "@/components/antidotes/controls";
import { PendingLabel } from "@/components/ds/pending-label";
import { Panel, PanelBody, PanelHeader } from "@/components/ds/surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Un nouveau post : un sujet, un angle, des consignes — et, depuis le radar,
 * le sujet proposé ou le post qui a inspiré, déjà remplis. La génération
 * prend une dizaine de secondes ; le brouillon s'ouvre ensuite.
 */
export function StudioNewForm({
  topic,
  source,
  libraryCount,
  anthropic,
}: {
  topic: { id: string; title: string; angle: string | null } | null;
  source: { id: string; author: string | null; excerpt: string } | null;
  libraryCount: number;
  anthropic: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<InboundResult | null, FormData>(createDraft, null);
  const lastState = useRef<InboundResult | null>(null);

  useEffect(() => {
    if (!state || state === lastState.current) return;
    lastState.current = state;
    if (state.ok) {
      toast.success(state.message ?? "Brouillon écrit.");
      if (state.id) router.push(`/antidotes/inbound/studio/${state.id}`);
    } else {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Panel>
      <PanelHeader
        title="Nouveau post"
        description={
          libraryCount > 0
            ? `${libraryCount} de vos posts servent d'exemples de ton.`
            : "La bibliothèque est vide : le studio écrira sobre, sans exemple de ton."
        }
        action={!anthropic ? <span className="type-caption text-warning-ink">ANTHROPIC_API_KEY absente</span> : null}
      />
      <PanelBody>
        <form action={formAction} className="grid gap-3">
          <input type="hidden" name="topicId" value={topic?.id ?? ""} />
          <input type="hidden" name="sourcePostId" value={source?.id ?? ""} />
          {source ? (
            <p className="type-caption rounded-md border border-border bg-surface-sunken px-3 py-2 text-text-secondary">
              Inspiré de {source.author ?? "un post de la veille"} : « {source.excerpt} »
            </p>
          ) : null}
          <div className="grid gap-1">
            <Label htmlFor="studio-topic">Sujet</Label>
            <Input id="studio-topic" name="topic" required minLength={5} maxLength={300} defaultValue={topic?.title ?? ""} autoFocus={!topic} placeholder="Pourquoi vos posts d'expertise n'attirent aucun client" />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="studio-angle">Angle</Label>
            <Input id="studio-angle" name="angle" maxLength={400} defaultValue={topic?.angle ?? ""} placeholder="Ce que le post affirmera, en une phrase" />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="studio-brief">Consignes</Label>
            <TextArea id="studio-brief" name="brief" maxLength={1000} className="min-h-20" placeholder="Un cas à citer, un chiffre, un ton particulier…" />
          </div>
          <div>
            <Button type="submit" variant="accent" disabled={pending || !anthropic}>
              <Sparkles aria-hidden />
              <PendingLabel pending={pending} busy="Écriture…">
                Écrire le post
              </PendingLabel>
            </Button>
          </div>
        </form>
      </PanelBody>
    </Panel>
  );
}
