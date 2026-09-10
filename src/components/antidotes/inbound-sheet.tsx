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
  type InboundResult,
} from "@/app/actions/antidotes-inbound";
import { TextArea } from "@/components/antidotes/controls";
import { PendingLabel } from "@/components/ds/pending-label";
import { StatusPill, type StatusTone } from "@/components/ds/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDate } from "@/lib/antidotes/dates";
import { formatEngagement } from "@/lib/antidotes/inbound/engagement";
import type { InboundPostDetail, LibraryPost, StudioAvailability, StudioPostDetail } from "@/lib/antidotes/inbound/queries";
import { LINKEDIN_MAX_CHARS } from "@/lib/antidotes/inbound/studio-prompt";
import {
  GENERATED_POST_FORMAT_LABELS,
  GENERATED_POST_STATUS_LABELS,
  POST_PLATFORM_LABELS,
  type GeneratedPost,
  type GeneratedPostFormat,
  type GeneratedPostStatus,
  type RadarTopic,
} from "@/lib/antidotes/types";
import { formatValue } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Le panneau de l'inbound — la même place que celui d'un prospect ou d'une
 * publication du planning : la ligne cliquée s'ouvre à droite, l'écran
 * derrière ne bouge pas.
 *
 * Il porte le geste central du pôle : **réécrire pour moi**. Un contenu qui a
 * marché ailleurs donne deux formes — un script de reel, un post LinkedIn —
 * écrites dans ma voix, relues à la main, approuvées, datées, publiées. Rien
 * ne part sans être passé par « approuvé ».
 */

const TONES: Record<GeneratedPostStatus, StatusTone> = {
  draft: "warning",
  approved: "info",
  published: "positive",
  rejected: "neutral",
};

const FORMATS: GeneratedPostFormat[] = ["reel_script", "linkedin_post"];

export function InboundSheet({
  postDetail,
  draftDetail,
  topic,
  myPost,
  studio,
  onClose,
}: {
  postDetail: InboundPostDetail | null;
  draftDetail: StudioPostDetail | null;
  topic: RadarTopic | null;
  myPost: LibraryPost | null;
  studio: StudioAvailability;
  onClose: () => void;
}) {
  const open = Boolean(postDetail || draftDetail || topic || myPost);

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <SheetContent className="w-full sm:max-w-xl">
        {postDetail ? <SourcePanel detail={postDetail} studio={studio} /> : null}
        {!postDetail && draftDetail ? <DraftPanel detail={draftDetail} studio={studio} /> : null}
        {!postDetail && !draftDetail && topic ? <TopicPanel topic={topic} studio={studio} /> : null}
        {!postDetail && !draftDetail && !topic && myPost ? <MinePanel post={myPost} /> : null}
      </SheetContent>
    </Sheet>
  );
}

/** Un contenu relevé : ce qu'il dit, ce qu'il a fait, et les deux formes à en tirer. */
function SourcePanel({ detail, studio }: { detail: InboundPostDetail; studio: StudioAvailability }) {
  const { post, account, score } = detail;
  const text = post.transcript?.trim() || post.content;

  return (
    <>
      <SheetHeader>
        <SheetTitle>{account?.label ?? post.author_handle ?? POST_PLATFORM_LABELS[post.platform]}</SheetTitle>
        <SheetDescription>
          {POST_PLATFORM_LABELS[post.platform]}
          {post.published_at ? ` · ${formatDate(post.published_at)}` : ""} · {formatEngagement(score)}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-5 overflow-y-auto px-5 pb-6">
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

        <section className="rounded-md border border-border bg-surface-sunken p-4">
          <p className="type-overline text-text-secondary">
            {post.transcript ? "Script de la vidéo" : "Contenu"}
          </p>
          <p className="type-body mt-2 whitespace-pre-wrap text-text-primary">{text}</p>
          {post.transcript && post.content && post.content !== post.transcript ? (
            <p className="type-caption mt-3 border-t border-border pt-3 whitespace-pre-wrap text-text-secondary">
              Légende : {post.content}
            </p>
          ) : null}
        </section>

        <Reshape drafts={detail.drafts} sourcePostId={post.id} studio={studio} />
      </div>
    </>
  );
}

/** Un brouillon ouvert directement : son texte, son état, sa date, sa source. */
function DraftPanel({ detail, studio }: { detail: StudioPostDetail; studio: StudioAvailability }) {
  const { post, source, examples, visualUrl } = detail;

  return (
    <>
      <SheetHeader>
        <SheetTitle>{post.topic ?? GENERATED_POST_FORMAT_LABELS[post.format]}</SheetTitle>
        <SheetDescription>
          {GENERATED_POST_FORMAT_LABELS[post.format]} · {GENERATED_POST_STATUS_LABELS[post.status]}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-5 overflow-y-auto px-5 pb-6">
        <DraftEditor draft={post} studio={studio} visualUrl={visualUrl} />

        {examples.length > 0 ? (
          <section>
            <p className="type-overline text-text-secondary">Exemples de ton</p>
            <ul className="mt-2 space-y-2">
              {examples.map((example) => (
                <li key={example.post.id} className="rounded-md border border-border p-3">
                  <p className="type-caption text-text-secondary">
                    similarité {Math.round(example.similarity * 100)} %
                    {example.post.published_at ? ` · ${formatDate(example.post.published_at)}` : ""}
                  </p>
                  <p className="type-caption mt-1 line-clamp-3 text-text-primary">{example.post.content}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {source ? (
          <section className="rounded-md border border-border bg-surface-sunken p-4">
            <p className="type-overline text-text-secondary">Matière</p>
            <p className="type-caption mt-1 text-text-secondary">
              {POST_PLATFORM_LABELS[source.platform]}
              {source.author_handle ? ` · ${source.author_handle}` : ""}
            </p>
            <p className="type-caption mt-2 line-clamp-6 whitespace-pre-wrap text-text-primary">
              {source.transcript?.trim() || source.content}
            </p>
          </section>
        ) : null}
      </div>
    </>
  );
}

/** Un sujet proposé : ce qu'il affirme, et les deux formes à en tirer. */
function TopicPanel({ topic, studio }: { topic: RadarTopic; studio: StudioAvailability }) {
  return (
    <>
      <SheetHeader>
        <SheetTitle>{topic.title}</SheetTitle>
        <SheetDescription>{topic.angle ?? "Sujet proposé par le radar"}</SheetDescription>
      </SheetHeader>
      <div className="space-y-5 overflow-y-auto px-5 pb-6">
        {topic.evidence.length > 0 ? (
          <section className="rounded-md border border-border bg-surface-sunken p-4">
            <p className="type-overline text-text-secondary">Ce qui l&apos;appuie</p>
            <ul className="mt-2 space-y-1">
              {topic.evidence.map((entry) => (
                <li key={entry.post_id} className="type-caption text-text-primary">
                  {entry.why}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <Reshape drafts={[]} topicId={topic.id} studio={studio} />
      </div>
    </>
  );
}

/** Un de mes posts publiés : son texte et ses chiffres, en lecture. */
function MinePanel({ post }: { post: LibraryPost }) {
  return (
    <>
      <SheetHeader>
        <SheetTitle>Mon post</SheetTitle>
        <SheetDescription>
          {post.published_at ? formatDate(post.published_at) : "Sans date"} ·{" "}
          {post.hasVector ? "vectorisé" : "sans vecteur"}
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-4 overflow-y-auto px-5 pb-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Metric label="Réactions" value={post.metrics.likes} />
          <Metric label="Commentaires" value={post.metrics.comments} />
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
        <p className="type-body whitespace-pre-wrap text-text-primary">{post.content}</p>
        {post.tags.length > 0 ? (
          <p className="type-caption text-text-secondary">{post.tags.join(" · ")}</p>
        ) : null}
      </div>
    </>
  );
}

/**
 * Les deux formes, côte à côte : un script de reel et un post LinkedIn tirés
 * de la même matière. L'onglet ouvert est celui qui a déjà un brouillon —
 * sinon le script, parce que c'est la forme que la veille inspire le plus.
 */
function Reshape({
  drafts,
  sourcePostId,
  topicId,
  studio,
}: {
  drafts: GeneratedPost[];
  sourcePostId?: string;
  topicId?: string;
  studio: StudioAvailability;
}) {
  const existing = (format: GeneratedPostFormat) => drafts.find((draft) => draft.format === format) ?? null;
  const [format, setFormat] = useState<GeneratedPostFormat>(
    () => FORMATS.find((entry) => existing(entry)) ?? "reel_script",
  );
  const draft = existing(format);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const write = () => {
    startTransition(async () => {
      const result = await generateDraft({ format, sourcePostId: sourcePostId ?? null, topicId: topicId ?? null });
      if (result.ok) {
        toast.success(result.message ?? "Écrit.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="type-overline text-text-secondary">Réécrire pour moi</p>
        <div className="inline-flex items-center gap-1 rounded-pill bg-surface-sunken p-1">
          {FORMATS.map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setFormat(entry)}
              aria-pressed={format === entry}
              className={cn(
                "type-caption focus-visible:ring-ring rounded-pill px-3 py-1 font-medium transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
                format === entry
                  ? "bg-primary text-primary-foreground"
                  : "text-text-secondary hover:text-text-primary",
              )}
            >
              {GENERATED_POST_FORMAT_LABELS[entry]}
            </button>
          ))}
        </div>
      </div>

      {draft ? (
        <DraftEditor draft={draft} studio={studio} visualUrl={null} onRewrite={write} rewriting={pending} />
      ) : (
        <div className="rounded-md border border-dashed border-border-strong p-5 text-center">
          <p className="type-body text-text-secondary">
            Aucun {GENERATED_POST_FORMAT_LABELS[format].toLowerCase()} tiré de cette matière.
          </p>
          <div className="mt-3 flex flex-col items-center gap-2">
            <Button type="button" variant="accent" onClick={write} disabled={pending || !studio.anthropic}>
              <Sparkles aria-hidden />
              <PendingLabel pending={pending} busy="Écriture…">
                Écrire
              </PendingLabel>
            </Button>
            {!studio.anthropic ? (
              <span className="type-caption text-warning-ink">ANTHROPIC_API_KEY absente</span>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

/** Le texte d'un brouillon et tout ce qu'on peut en faire. */
function DraftEditor({
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

  /* Le brouillon change quand on passe d'un format à l'autre, ou après une
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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusPill tone={TONES[draft.status]}>{GENERATED_POST_STATUS_LABELS[draft.status]}</StatusPill>
        <span className="type-caption text-text-secondary tabular-nums">
          {content.length.toLocaleString("fr-FR")}
          {linkedin ? ` / ${LINKEDIN_MAX_CHARS.toLocaleString("fr-FR")}` : ""} caractères
        </span>
      </div>

      <TextArea
        aria-label="Texte du brouillon"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        readOnly={published}
        className="min-h-64"
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
        <div className="grid gap-2 rounded-md border border-border p-4">
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

      {linkedin && !published ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label="Ce que l'image montre"
            value={imagePrompt}
            onChange={(event) => setImagePrompt(event.target.value)}
            placeholder="portrait en atelier, lumière naturelle, regard caméra"
            className="min-w-0 flex-1"
          />
          <Button
            type="button"
            variant="outline"
            disabled={pending || Boolean(studio.visual) || imagePrompt.trim().length < 5}
            title={studio.visual ?? undefined}
            onClick={() => run(() => generateVisualNow({ postId: draft.id, prompt: imagePrompt }))}
          >
            <ImageIcon aria-hidden />
            <PendingLabel pending={pending} busy="Génération…">
              Générer le visuel
            </PendingLabel>
          </Button>
          {studio.visual ? <span className="type-caption text-text-secondary">{studio.visual}</span> : null}
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
