"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, ExternalLink, Image as ImageIcon, PenLine, Send, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteDraft,
  generateDraft,
  generateVisualNow,
  publishDraftNow,
  saveDraftText,
  scheduleDraft,
  setDraftStatus,
  updateReferencePost,
  type InboundResult,
} from "@/app/actions/antidotes-inbound";
import { TextArea } from "@/components/antidotes/controls";
import { PlatformChip } from "@/components/antidotes/inbound-chips";
import { PendingLabel } from "@/components/ds/pending-label";
import { StatusPill, type StatusTone } from "@/components/ds/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDate } from "@/lib/antidotes/dates";
import { formatEngagement } from "@/lib/antidotes/inbound/engagement";
import { FORMAT_MAX_CHARS, INBOUND_FORMATS } from "@/lib/antidotes/inbound/prompts";
import type { InboundContent, StudioAvailability } from "@/lib/antidotes/inbound/queries";
import {
  GENERATED_POST_FORMAT_ACTIONS,
  GENERATED_POST_FORMAT_LABELS,
  GENERATED_POST_STATUS_LABELS,
  MEDIA_KIND_LABELS,
  POST_PLATFORM_LABELS,
  type GeneratedPost,
  type GeneratedPostFormat,
  type GeneratedPostStatus,
} from "@/lib/antidotes/types";
import { formatValue } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Le panneau de l'inbound — la même place que celui d'un prospect ou d'une
 * publication du planning : la ligne cliquée s'ouvre à droite, l'écran
 * derrière ne bouge pas.
 *
 * Deux parties, et pas une de plus : **le contenu actuel** — ce qui a été
 * publié, ses visuels, son script, ses chiffres — puis **ce qu'on en tire**,
 * dans l'une des trois formes. Les exemples de ton, le taux de similarité et
 * le rappel de la matière ont disparu : on regardait la matière juste
 * au-dessus, et un pourcentage de proximité ne change aucune décision.
 *
 * Tout ce qu'il affiche vient de la lecture de la page : il s'ouvre sans rien
 * demander au serveur.
 */

const TONES: Record<GeneratedPostStatus, StatusTone> = {
  draft: "warning",
  approved: "info",
  published: "positive",
  rejected: "neutral",
};

export function InboundSheet({
  content,
  drafts,
  loneDraft,
  visuals,
  studio,
  onClose,
}: {
  /** La ligne ouverte, ou nulle. */
  content: InboundContent | null;
  /** Les brouillons tirés de cette ligne, un par forme au plus. */
  drafts: GeneratedPost[];
  /** Un brouillon sans matière — ouvert depuis le calendrier, quand sa source
      a disparu ou qu'il vient d'un sujet de l'ancienne forme. */
  loneDraft: GeneratedPost | null;
  visuals: Record<string, string>;
  studio: StudioAvailability;
  onClose: () => void;
}) {
  const open = content !== null || loneDraft !== null;
  return (
    <Sheet open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <SheetContent className="w-full sm:max-w-2xl">
        {content ? (
          <ContentPanel entry={content} drafts={drafts} visuals={visuals} studio={studio} />
        ) : loneDraft ? (
          <>
            <SheetHeader>
              <SheetTitle>{loneDraft.topic ?? GENERATED_POST_FORMAT_LABELS[loneDraft.format]}</SheetTitle>
              <SheetDescription>
                {GENERATED_POST_FORMAT_LABELS[loneDraft.format]} · {GENERATED_POST_STATUS_LABELS[loneDraft.status]}
              </SheetDescription>
            </SheetHeader>
            <div className="overflow-y-auto px-5 pb-6">
              <DraftEditor draft={loneDraft} studio={studio} visualUrl={visuals[loneDraft.id] ?? null} />
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ContentPanel({
  entry,
  drafts,
  visuals,
  studio,
}: {
  entry: InboundContent;
  drafts: GeneratedPost[];
  visuals: Record<string, string>;
  studio: StudioAvailability;
}) {
  const { post, account, score } = entry;

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <PlatformChip platform={post.platform} mine={post.is_mine} />
          {post.is_mine ? "Mon post" : (account?.label ?? post.author_handle ?? POST_PLATFORM_LABELS[post.platform])}
        </SheetTitle>
        <SheetDescription>
          {POST_PLATFORM_LABELS[post.platform]}
          {post.published_at ? ` · ${formatDate(post.published_at)}` : ""}
          {post.media_kind ? ` · ${MEDIA_KIND_LABELS[post.media_kind]}` : ""} · {formatEngagement(score)}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-6 overflow-y-auto px-5 pb-6">
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Metric label="Vues" value={post.metrics.views} />
            <Metric label="Likes" value={post.metrics.likes} />
            <Metric label="Commentaires" value={post.metrics.comments} />
            <Metric label="Partages" value={post.metrics.shares} />
            <Metric label="Enregistrements" value={post.metrics.saves} />
            {post.url ? (
              <a
                href={post.url}
                target="_blank"
                rel="noreferrer"
                className="type-caption focus-visible:ring-ring ml-auto inline-flex items-center gap-1 rounded-sm text-accent-ink hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                Ouvrir <ExternalLink className="size-3" strokeWidth={1.75} aria-hidden />
              </a>
            ) : null}
          </div>

          <Media url={post.media_url} kind={post.media_kind} />

          <SourceText
            postId={post.id}
            transcript={post.transcript}
            content={post.content}
          />
        </section>

        <Reshape sourcePostId={post.id} drafts={drafts} visuals={visuals} studio={studio} />
      </div>
    </>
  );
}

/**
 * Le média relevé. Les URL rendues par les réseaux périment en quelques
 * jours : une image cassée dirait « panne » là où il n'y a qu'un lien mort,
 * donc l'échec de chargement retire l'aperçu au lieu de l'afficher brisé.
 */
function Media({ url, kind }: { url: string | null; kind: string | null }) {
  const [broken, setBroken] = useState(false);
  if (!url || broken) return null;
  if (kind === "video") {
    return (
      <video
        src={url}
        controls
        preload="metadata"
        onError={() => setBroken(true)}
        className="max-h-80 w-full rounded-md border border-border bg-surface-sunken"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- média externe, périssable
    <img
      src={url}
      alt=""
      onError={() => setBroken(true)}
      className="max-h-80 w-full rounded-md border border-border object-contain"
    />
  );
}

/** Le script ou la légende, relu et corrigé sur place. */
function SourceText({
  postId,
  transcript,
  content,
}: {
  postId: string;
  transcript: string | null;
  content: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isScript = Boolean(transcript?.trim());
  const [text, setText] = useState(transcript?.trim() || content);
  const [saved, setSaved] = useState(text);

  const [seen, setSeen] = useState(postId);
  if (seen !== postId) {
    setSeen(postId);
    const next = transcript?.trim() || content;
    setText(next);
    setSaved(next);
  }

  const save = () => {
    startTransition(async () => {
      const result = await updateReferencePost(
        isScript ? { postId, transcript: text } : { postId, content: text },
      );
      if (result.ok) {
        setSaved(text);
        toast.success("Enregistré.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="type-overline text-text-secondary">{isScript ? "Script de la vidéo" : "Contenu"}</p>
        {text !== saved ? (
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={save}>
            <PendingLabel pending={pending} busy="Enregistrement…">
              Enregistrer
            </PendingLabel>
          </Button>
        ) : null}
      </div>
      <TextArea
        aria-label={isScript ? "Script de la vidéo" : "Contenu du post"}
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="min-h-40"
      />
      {isScript && content && content !== transcript ? (
        <p className="type-caption whitespace-pre-wrap text-text-secondary">Légende : {content}</p>
      ) : null}
    </div>
  );
}

/**
 * Ce qu'on en tire : trois boutons, un par forme. Une forme déjà écrite
 * devient un onglet — on relit, on corrige, on date, on publie.
 */
function Reshape({
  sourcePostId,
  drafts,
  visuals,
  studio,
}: {
  sourcePostId: string;
  drafts: GeneratedPost[];
  visuals: Record<string, string>;
  studio: StudioAvailability;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<GeneratedPostFormat | null>(null);
  const [format, setFormat] = useState<GeneratedPostFormat | null>(
    () => INBOUND_FORMATS.find((entry) => drafts.some((draft) => draft.format === entry)) ?? null,
  );

  /* Le panneau change de ligne sans se démonter : l'onglet ouvert doit suivre
     la nouvelle matière, sinon il montre le brouillon de la ligne d'avant.
     Ajustement pendant le rendu, comme partout dans le dépôt — un effet
     ferait clignoter le panneau d'un tour. */
  const [seen, setSeen] = useState(sourcePostId);
  if (seen !== sourcePostId) {
    setSeen(sourcePostId);
    setFormat(INBOUND_FORMATS.find((entry) => drafts.some((draft) => draft.format === entry)) ?? null);
  }

  const write = (target: GeneratedPostFormat) => {
    setBusy(target);
    startTransition(async () => {
      const result = await generateDraft({ format: target, sourcePostId });
      if (result.ok) {
        setFormat(target);
        toast.success(result.message ?? "Écrit.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setBusy(null);
    });
  };

  const draft = format ? (drafts.find((entry) => entry.format === format) ?? null) : null;

  return (
    <section className="space-y-3 border-t border-border pt-5">
      <p className="type-overline text-text-secondary">Réécrire pour moi</p>

      <div className="flex flex-wrap gap-2">
        {INBOUND_FORMATS.map((entry) => {
          const existing = drafts.find((item) => item.format === entry) ?? null;
          return (
            <Button
              key={entry}
              type="button"
              variant={existing ? "outline" : "accent"}
              size="sm"
              disabled={pending || !studio.anthropic}
              title={studio.anthropic ? undefined : "ANTHROPIC_API_KEY absente"}
              onClick={() => (existing ? setFormat(entry) : write(entry))}
              aria-pressed={existing ? format === entry : undefined}
              className={cn(existing && format === entry && "border-accent-ink text-accent-ink")}
            >
              {existing ? null : <Sparkles aria-hidden />}
              <PendingLabel pending={busy === entry} busy="Écriture…">
                {existing ? GENERATED_POST_FORMAT_LABELS[entry] : GENERATED_POST_FORMAT_ACTIONS[entry]}
              </PendingLabel>
            </Button>
          );
        })}
      </div>

      {!studio.anthropic ? (
        <p className="type-caption text-warning-ink">ANTHROPIC_API_KEY absente : rien ne peut s&apos;écrire.</p>
      ) : null}

      {draft ? (
        <DraftEditor
          draft={draft}
          studio={studio}
          visualUrl={visuals[draft.id] ?? null}
          onRewrite={() => write(draft.format)}
          rewriting={busy === draft.format}
        />
      ) : null}
    </section>
  );
}

/** Le texte d'un brouillon et tout ce qu'on peut en faire. */
export function DraftEditor({
  draft,
  studio,
  visualUrl,
  onRewrite,
  rewriting,
}: {
  draft: GeneratedPost;
  studio: StudioAvailability;
  visualUrl: string | null;
  onRewrite?: () => void;
  rewriting?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [content, setContent] = useState(draft.content);
  const [saved, setSaved] = useState(draft.content);
  const [date, setDate] = useState(toLocalInput(draft.scheduled_at));
  const [imagePrompt, setImagePrompt] = useState(draft.image_prompt ?? "");

  /* Le brouillon change quand on passe d'une forme à l'autre, ou après une
     réécriture. L'éditeur suit **pendant le rendu** — le pattern « adjusting
     state when props change » de React, déjà employé par `useOptimisticPill`
     et les cellules du Planning : un effet ferait clignoter le texte d'un
     tour de rendu, et le lint refuse un `setState` synchrone en effet. */
  const [seen, setSeen] = useState({ id: draft.id, content: draft.content, scheduled: draft.scheduled_at, prompt: draft.image_prompt });
  if (
    seen.id !== draft.id ||
    seen.content !== draft.content ||
    seen.scheduled !== draft.scheduled_at ||
    seen.prompt !== draft.image_prompt
  ) {
    setSeen({ id: draft.id, content: draft.content, scheduled: draft.scheduled_at, prompt: draft.image_prompt });
    setContent(draft.content);
    setSaved(draft.content);
    setDate(toLocalInput(draft.scheduled_at));
    setImagePrompt(draft.image_prompt ?? "");
  }

  const published = draft.status === "published";
  const dirty = content !== saved;
  const linkedin = draft.format === "linkedin_post";

  const run = (action: () => Promise<InboundResult>, after?: () => void) => {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message ?? "Fait.");
        if (after) after();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-3 rounded-md border border-border bg-surface-sunken p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusPill tone={TONES[draft.status]}>{GENERATED_POST_STATUS_LABELS[draft.status]}</StatusPill>
        <span className="type-caption text-text-secondary tabular-nums">
          {content.length.toLocaleString("fr-FR")} / {FORMAT_MAX_CHARS[draft.format].toLocaleString("fr-FR")} caractères
        </span>
      </div>

      <TextArea
        aria-label="Texte du brouillon"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        readOnly={published}
        className="min-h-64 bg-surface"
      />

      {visualUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL signée, une heure
        <img src={visualUrl} alt="" className="w-full rounded-md border border-border" />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {!published ? (
          <>
            <Button
              type="button"
              variant="accent"
              disabled={pending || !dirty}
              onClick={() => run(() => saveDraftText({ postId: draft.id, content }), () => setSaved(content))}
            >
              <PendingLabel pending={pending} busy="Enregistrement…">
                Enregistrer
              </PendingLabel>
            </Button>
            {onRewrite ? (
              <Button type="button" variant="outline" disabled={rewriting || !studio.anthropic} onClick={onRewrite}>
                <Sparkles aria-hidden />
                <PendingLabel pending={Boolean(rewriting)} busy="Écriture…">
                  Réécrire
                </PendingLabel>
              </Button>
            ) : null}
            {draft.status === "draft" ? (
              <Button
                type="button"
                variant="outline"
                disabled={pending || dirty}
                title={dirty ? "Enregistrez d'abord" : undefined}
                onClick={() => run(() => setDraftStatus({ postId: draft.id, status: "approved" }))}
              >
                Approuver
              </Button>
            ) : null}
            {draft.status === "approved" ? (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => run(() => setDraftStatus({ postId: draft.id, status: "draft" }))}
              >
                Remettre en brouillon
              </Button>
            ) : null}
            {draft.status === "rejected" ? (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => run(() => setDraftStatus({ postId: draft.id, status: "draft" }))}
              >
                Reprendre
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => run(() => setDraftStatus({ postId: draft.id, status: "rejected" }))}
              >
                Écarter
              </Button>
            )}
          </>
        ) : draft.published_url ? (
          <a
            href={draft.published_url}
            target="_blank"
            rel="noreferrer"
            className="type-caption focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm text-accent-ink hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            Voir la publication <ExternalLink className="size-3" strokeWidth={1.75} aria-hidden />
          </a>
        ) : null}
      </div>

      {!published ? (
        <div className="grid gap-2 rounded-md border border-border bg-surface p-4">
          <Label htmlFor={`date-${draft.id}`} className="type-caption text-text-secondary">
            <CalendarClock className="mr-1 inline size-3.5" strokeWidth={1.75} aria-hidden />
            {linkedin ? "Part tout seul à cette date, une fois approuvé" : "Repère dans le calendrier"}
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id={`date-${draft.id}`}
              type="datetime-local"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-56"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || date === toLocalInput(draft.scheduled_at)}
              onClick={() =>
                run(() => scheduleDraft({ postId: draft.id, scheduledAt: date ? new Date(date).toISOString() : null }))
              }
            >
              Programmer
            </Button>
            {draft.scheduled_at ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => run(() => scheduleDraft({ postId: draft.id, scheduledAt: null }), () => setDate(""))}
              >
                Retirer la date
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!published ? (
        <div className="grid gap-2 rounded-md border border-border bg-surface p-4">
          <Label htmlFor={`visuel-${draft.id}`} className="type-caption text-text-secondary">
            <ImageIcon className="mr-1 inline size-3.5" strokeWidth={1.75} aria-hidden />
            Ce que l&apos;image doit montrer
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id={`visuel-${draft.id}`}
              value={imagePrompt}
              onChange={(event) => setImagePrompt(event.target.value)}
              placeholder="selfie en atelier, lumière naturelle, regard caméra"
              className="min-w-0 flex-1"
            />
            <Button
              type="button"
              variant="outline"
              disabled={pending || Boolean(studio.visual) || imagePrompt.trim().length < 5}
              title={studio.visual ?? undefined}
              onClick={() => run(() => generateVisualNow({ postId: draft.id, prompt: imagePrompt }))}
            >
              <PendingLabel pending={pending} busy="Génération…">
                Générer la photo
              </PendingLabel>
            </Button>
          </div>
          {/* Un seul générateur est branché : le dire vaut mieux qu'offrir un
              bouton mort à côté. */}
          <p className="type-caption text-text-secondary">
            {studio.visual ?? "Modèle entraîné sur mon visage (Replicate). Les autres générateurs viendront avec leur clé."}
          </p>
        </div>
      ) : null}

      {linkedin && !published ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="accent"
            disabled={pending || Boolean(studio.publish) || draft.status !== "approved"}
            title={studio.publish ?? (draft.status !== "approved" ? "Approuvez d'abord" : undefined)}
            onClick={() => run(() => publishDraftNow({ postId: draft.id }))}
          >
            <Send aria-hidden />
            <PendingLabel pending={pending} busy="Publication…">
              Publier sur LinkedIn
            </PendingLabel>
          </Button>
          {studio.publish ? <span className="type-caption text-text-secondary">{studio.publish}</span> : null}
        </div>
      ) : null}

      {!linkedin && !published ? (
        <p className="type-caption text-text-secondary">
          <PenLine className="mr-1 inline size-3.5" strokeWidth={1.75} aria-hidden />
          Un script se tourne : rien ne part d&apos;ici.
        </p>
      ) : null}

      {draft.error ? <p className="type-caption text-danger-ink">{draft.error}</p> : null}

      {!published ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!window.confirm("Supprimer ce brouillon ?")) return;
            run(() => deleteDraft({ postId: draft.id }));
          }}
          className="type-caption focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm text-text-secondary hover:text-danger-ink focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
        >
          <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden />
          Supprimer
        </button>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | undefined }) {
  return (
    <span className="type-caption text-text-secondary">
      {label}{" "}
      <span className="font-medium text-text-primary tabular-nums">
        {value === undefined ? "—" : formatValue(value, "integer")}
      </span>
    </span>
  );
}

/**
 * `datetime-local` attend une heure **locale** sans fuseau ; la base porte de
 * l'UTC. La conversion se fait ici, une fois, dans les deux sens.
 */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
