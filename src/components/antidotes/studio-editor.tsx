"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Image as ImageIcon, RefreshCw, Send, Trash2, Undo2, X } from "lucide-react";
import { toast } from "sonner";

import {
  deleteDraft,
  generateVisualNow,
  publishDraftNow,
  regenerateDraft,
  saveDraft,
  setDraftStatus,
  type InboundResult,
} from "@/app/actions/antidotes-inbound";
import { TextArea } from "@/components/antidotes/controls";
import { PendingLabel } from "@/components/ds/pending-label";
import { Panel, PanelBody, PanelHeader } from "@/components/ds/surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LINKEDIN_MAX_CHARS } from "@/lib/antidotes/inbound/studio-prompt";
import type { StudioAvailability } from "@/lib/antidotes/inbound/queries";
import type { GeneratedPost } from "@/lib/antidotes/types";

/**
 * L'éditeur d'un post : le texte, à relire et corriger — la validation
 * humaine est le passage obligé —, le visuel, puis approuver, publier,
 * écarter. Un post publié devient lecture seule : il est la trace de ce qui
 * est parti.
 */
export function StudioEditor({
  post,
  visualUrl,
  availability,
}: {
  post: GeneratedPost;
  visualUrl: string | null;
  availability: StudioAvailability;
}) {
  const router = useRouter();
  const [state, formAction, saving] = useActionState<InboundResult | null, FormData>(saveDraft, null);
  const lastState = useRef<InboundResult | null>(null);
  const [content, setContent] = useState(post.content);
  const [imagePrompt, setImagePrompt] = useState(post.image_prompt ?? "");
  // Ce qui a été soumis en dernier : quand l'action répond « ok », c'est ce
  // que le serveur connaît, sans attendre le rechargement de la page.
  const [submitted, setSubmitted] = useState({ content: post.content, imagePrompt: post.image_prompt ?? "" });
  const saved = state?.ok ? submitted : { content: post.content, imagePrompt: post.image_prompt ?? "" };
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const readOnly = post.status === "published";

  useEffect(() => {
    if (!state || state === lastState.current) return;
    lastState.current = state;
    if (state.ok) {
      toast.success(state.message ?? "Enregistré.");
      router.refresh();
    } else {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function run(kind: string, action: () => Promise<InboundResult>, after?: () => void) {
    setBusy(kind);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message ?? "Fait.");
        if (after) after();
        else router.refresh();
      } else {
        toast.error(result.error);
      }
      setBusy(null);
    });
  }

  const dirty = content !== saved.content || imagePrompt !== saved.imagePrompt;

  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader
          title="Texte"
          description={`${content.length.toLocaleString("fr-FR")} / ${LINKEDIN_MAX_CHARS.toLocaleString("fr-FR")} caractères`}
          action={
            !readOnly ? (
              <span className="flex flex-wrap items-center justify-end gap-2">
                {!availability.anthropic ? <span className="type-caption text-warning-ink">ANTHROPIC_API_KEY absente</span> : null}
                <Button type="button" size="sm" variant="outline" disabled={pending || !availability.anthropic} onClick={() => run("regenerate", () => regenerateDraft({ postId: post.id }))}>
                  <RefreshCw aria-hidden />
                  <PendingLabel pending={pending && busy === "regenerate"} busy="Écriture…">
                    Réécrire
                  </PendingLabel>
                </Button>
              </span>
            ) : null
          }
        />
        <PanelBody>
          <form action={formAction} onSubmit={() => setSubmitted({ content, imagePrompt })} className="grid gap-3">
            <input type="hidden" name="postId" value={post.id} />
            <TextArea
              name="content"
              aria-label="Texte du post"
              value={content}
              readOnly={readOnly}
              maxLength={LINKEDIN_MAX_CHARS}
              onChange={(event) => setContent(event.target.value)}
              className="min-h-72 text-[15px] leading-relaxed"
            />
            <div className="grid gap-1">
              <Label htmlFor="studio-image-prompt">Visuel : ce que l&apos;image montre</Label>
              <Input
                id="studio-image-prompt"
                name="imagePrompt"
                value={imagePrompt}
                readOnly={readOnly}
                maxLength={600}
                onChange={(event) => setImagePrompt(event.target.value)}
                placeholder="portrait en atelier, lumière naturelle, regard caméra"
              />
            </div>
            {!readOnly ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" disabled={saving || !dirty}>
                  <PendingLabel pending={saving} busy="Enregistrement…">
                    Enregistrer
                  </PendingLabel>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending || !!availability.visual || imagePrompt.trim().length < 5}
                  title={availability.visual ?? undefined}
                  onClick={() => run("visual", () => generateVisualNow({ postId: post.id, prompt: imagePrompt }))}
                >
                  <ImageIcon aria-hidden />
                  <PendingLabel pending={pending && busy === "visual"} busy="Génération…">
                    Générer le visuel
                  </PendingLabel>
                </Button>
                {availability.visual ? <span className="type-caption text-text-secondary">{availability.visual}</span> : null}
              </div>
            ) : null}
          </form>
          {visualUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={visualUrl} alt="Visuel du post" className="mt-4 max-h-96 rounded-md border border-border" />
          ) : null}
          {post.error ? <p className="type-caption mt-3 text-danger-ink">{post.error}</p> : null}
        </PanelBody>
      </Panel>

      <div className="flex flex-wrap items-center gap-2">
        {post.status === "draft" ? (
          <Button type="button" variant="accent" disabled={pending || dirty} title={dirty ? "Enregistrez d'abord" : undefined} onClick={() => run("approve", () => setDraftStatus({ postId: post.id, status: "approved" }))}>
            <Check aria-hidden />
            Approuver
          </Button>
        ) : null}
        {post.status === "approved" ? (
          <>
            <Button
              type="button"
              variant="accent"
              disabled={pending || !!availability.publish}
              title={availability.publish ?? undefined}
              onClick={() => run("publish", () => publishDraftNow({ postId: post.id }))}
            >
              <Send aria-hidden />
              <PendingLabel pending={pending && busy === "publish"} busy="Publication…">
                Publier sur LinkedIn
              </PendingLabel>
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={() => run("draft", () => setDraftStatus({ postId: post.id, status: "draft" }))}>
              <Undo2 aria-hidden />
              Remettre en brouillon
            </Button>
          </>
        ) : null}
        {post.status === "rejected" ? (
          <Button type="button" variant="outline" disabled={pending} onClick={() => run("draft", () => setDraftStatus({ postId: post.id, status: "draft" }))}>
            <Undo2 aria-hidden />
            Reprendre
          </Button>
        ) : null}
        {post.status === "draft" || post.status === "approved" ? (
          <Button type="button" variant="ghost" disabled={pending} onClick={() => run("reject", () => setDraftStatus({ postId: post.id, status: "rejected" }))}>
            <X aria-hidden />
            Écarter
          </Button>
        ) : null}
        {!readOnly ? (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            className="ml-auto text-danger-ink"
            onClick={() => {
              if (window.confirm("Supprimer ce brouillon ?")) {
                run("delete", () => deleteDraft({ postId: post.id }), () => router.push("/antidotes/inbound/studio"));
              }
            }}
          >
            <Trash2 aria-hidden />
            Supprimer
          </Button>
        ) : null}
      </div>
    </div>
  );
}
