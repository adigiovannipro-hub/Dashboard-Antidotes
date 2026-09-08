"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteMyPost, updateMyPost } from "@/app/actions/antidotes-inbound";
import { StatusPill } from "@/components/ds/status-pill";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/antidotes/dates";
import type { LibraryPost } from "@/lib/antidotes/inbound/queries";

/**
 * Un de mes posts dans la bibliothèque : le texte replié, ses chiffres et ses
 * étiquettes éditables au blur, l'état de son vecteur, le retrait.
 */
export function LibraryRow({ post }: { post: LibraryPost }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [tags, setTags] = useState(post.tags.join(", "));
  const [likes, setLikes] = useState(post.metrics.likes?.toString() ?? "");
  const [comments, setComments] = useState(post.metrics.comments?.toString() ?? "");

  function save(patch: Omit<Parameters<typeof updateMyPost>[0], "postId">) {
    startTransition(async () => {
      const result = await updateMyPost({ postId: post.id, ...patch });
      if (result.ok) router.refresh();
      else toast.error(result.error);
    });
  }

  function remove() {
    if (!window.confirm("Retirer ce post de la bibliothèque ?")) return;
    startTransition(async () => {
      const result = await deleteMyPost({ postId: post.id });
      if (result.ok) {
        toast.success(result.message ?? "Retiré.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const number = (value: string) => (value.trim() === "" ? null : Math.max(0, Math.round(Number(value)) || 0));

  return (
    <div className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="min-w-0">
        <div className="type-caption flex flex-wrap items-center gap-2 text-text-secondary">
          <span>{post.published_at ? formatDate(post.published_at) : "Sans date"}</span>
          {post.url ? (
            <a href={post.url} target="_blank" rel="noreferrer" className="focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm text-accent-ink hover:underline focus-visible:ring-2 focus-visible:outline-none">
              Ouvrir <ExternalLink className="size-3" strokeWidth={1.75} aria-hidden />
            </a>
          ) : null}
          <StatusPill tone={post.hasVector ? "positive" : "neutral"} dot={false}>
            {post.hasVector ? "Vectorisé" : "Sans vecteur"}
          </StatusPill>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="focus-visible:ring-ring mt-1 block w-full rounded-sm text-left focus-visible:ring-2 focus-visible:outline-none"
        >
          <p className={expanded ? "type-body whitespace-pre-wrap text-text-primary" : "type-body line-clamp-3 whitespace-pre-wrap text-text-primary"}>
            {post.content}
          </p>
        </button>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 lg:pt-6">
        <Input
          aria-label="Réactions"
          className="min-w-0"
          type="number"
          min={0}
          value={likes}
          placeholder="Réactions"
          onChange={(event) => setLikes(event.target.value)}
          onBlur={() => {
            if ((post.metrics.likes?.toString() ?? "") !== likes) save({ likes: number(likes) });
          }}
        />
        <Input
          aria-label="Commentaires"
          className="min-w-0"
          type="number"
          min={0}
          value={comments}
          placeholder="Commentaires"
          onChange={(event) => setComments(event.target.value)}
          onBlur={() => {
            if ((post.metrics.comments?.toString() ?? "") !== comments) save({ comments: number(comments) });
          }}
        />
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          aria-label="Retirer ce post"
          className="focus-visible:ring-ring rounded-sm p-2 text-text-secondary hover:text-danger-ink focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
        >
          <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
        <Input
          aria-label="Étiquettes"
          className="col-span-3"
          value={tags}
          placeholder="Étiquettes, séparées par des virgules"
          onChange={(event) => setTags(event.target.value)}
          onBlur={() => {
            if (post.tags.join(", ") !== tags) save({ tags });
          }}
        />
      </div>
    </div>
  );
}
