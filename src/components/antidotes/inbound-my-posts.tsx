"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PenLine } from "lucide-react";

import { LibraryAddDialog } from "@/components/antidotes/library-add-dialog";
import { EmbedButton, LibraryImportForm } from "@/components/antidotes/library-tools";
import { EmptyState } from "@/components/ds/empty-state";
import { StatusPill, type StatusTone } from "@/components/ds/status-pill";
import { Panel, PanelBody, PanelHeader } from "@/components/ds/surface";
import { formatDate } from "@/lib/antidotes/dates";
import type { LibraryPost } from "@/lib/antidotes/inbound/queries";
import {
  GENERATED_POST_FORMAT_LABELS,
  GENERATED_POST_STATUS_LABELS,
  type GeneratedPost,
  type GeneratedPostStatus,
} from "@/lib/antidotes/types";
import { formatValue } from "@/lib/format";

/**
 * Ce qui est à moi : mes posts déjà publiés — le corpus qui donne le ton —
 * et mes brouillons, dans un seul tableau. Les séparer obligeait à deviner
 * où chercher « le post sur le prix » : celui que j'ai publié, ou celui que
 * le studio vient d'écrire ?
 */

const TONES: Record<GeneratedPostStatus, StatusTone> = {
  draft: "warning",
  approved: "info",
  published: "positive",
  rejected: "neutral",
};

type Row =
  | { kind: "mine"; id: string; date: string | null; text: string; post: LibraryPost }
  | { kind: "draft"; id: string; date: string | null; text: string; draft: GeneratedPost };

export function InboundMyPosts({
  posts,
  drafts,
  embeddings,
}: {
  posts: LibraryPost[];
  drafts: GeneratedPost[];
  embeddings: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const rows = useMemo<Row[]>(() => {
    const all: Row[] = [
      ...posts.map((post): Row => ({ kind: "mine", id: post.id, date: post.published_at, text: post.content, post })),
      ...drafts.map((draft): Row => ({
        kind: "draft",
        id: draft.id,
        date: draft.published_at ?? draft.scheduled_at ?? draft.created_at,
        text: draft.content,
        draft,
      })),
    ];
    return all.sort((a, b) => (b.date ? Date.parse(b.date) : 0) - (a.date ? Date.parse(a.date) : 0));
  }, [posts, drafts]);

  const withoutVector = posts.filter((post) => !post.hasVector).length;

  const open = (row: Row) => {
    const query = new URLSearchParams(params.toString());
    for (const key of ["post", "brouillon", "sujet", "mien"]) query.delete(key);
    query.set(row.kind === "mine" ? "mien" : "brouillon", row.id);
    router.push(`${pathname}?${query.toString()}`, { scroll: false });
  };

  return (
    <Panel>
      <PanelHeader
        title="Mes posts"
        count={rows.length}
        description={
          embeddings
            ? `${posts.length} publiés · ${drafts.length} écrits ici`
            : `${posts.length} publiés · ${drafts.length} écrits ici · rapprochement lexical`
        }
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <EmbedButton missing={withoutVector} available={embeddings} />
            <LibraryImportForm />
            <LibraryAddDialog />
          </div>
        }
      />

      {rows.length === 0 ? (
        <PanelBody>
          <EmptyState
            icon={PenLine}
            message="Rien encore. Collez trente de vos meilleurs posts, ou importez l'export LinkedIn : c'est ce corpus qui donne le ton."
          />
        </PanelBody>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] border-collapse">
            <thead>
              <tr className="border-b border-border-strong">
                <th scope="col" className="type-overline px-3 py-2 text-left text-text-secondary">
                  Type
                </th>
                <th scope="col" className="type-overline px-3 py-2 text-left text-text-secondary">
                  Contenu
                </th>
                <th scope="col" className="type-overline px-3 py-2 text-left text-text-secondary">
                  État
                </th>
                <th scope="col" className="type-overline px-3 py-2 text-right text-text-secondary">
                  Réactions
                </th>
                <th scope="col" className="type-overline px-3 py-2 text-right text-text-secondary">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.kind}-${row.id}`}
                  onClick={() => open(row)}
                  className="cursor-pointer border-b border-border transition-colors duration-(--motion-duration) ease-standard last:border-0 hover:bg-muted"
                >
                  <td className="px-3 py-2.5">
                    <span className="type-caption whitespace-nowrap rounded-pill bg-surface-sunken px-2 py-0.5 text-text-secondary">
                      {row.kind === "mine" ? "Post publié" : GENERATED_POST_FORMAT_LABELS[row.draft.format]}
                    </span>
                  </td>
                  <td className="max-w-lg px-3 py-2.5">
                    <span className="type-body line-clamp-2 text-text-primary">{row.text}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    {row.kind === "mine" ? (
                      <StatusPill tone={row.post.hasVector ? "positive" : "neutral"} dot={false}>
                        {row.post.hasVector ? "Vectorisé" : "Sans vecteur"}
                      </StatusPill>
                    ) : (
                      <StatusPill tone={TONES[row.draft.status]}>
                        {GENERATED_POST_STATUS_LABELS[row.draft.status]}
                      </StatusPill>
                    )}
                  </td>
                  <td className="type-body px-3 py-2.5 text-right text-text-primary tabular-nums">
                    {row.kind === "mine" && row.post.metrics.likes !== undefined
                      ? formatValue(row.post.metrics.likes, "integer")
                      : "—"}
                  </td>
                  <td className="type-caption px-3 py-2.5 text-right whitespace-nowrap text-text-secondary tabular-nums">
                    {row.date ? formatDate(row.date) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
