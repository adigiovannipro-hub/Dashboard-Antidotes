"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { PlatformChip } from "@/components/antidotes/inbound-chips";
import { useInboundUrl } from "@/components/antidotes/inbound-url";
import { Panel, PanelBody, PanelHeader } from "@/components/ds/surface";
import { Button } from "@/components/ui/button";
import { buildCalendarMonth, monthKeyOf, WEEKDAY_LABELS } from "@/lib/antidotes/inbound/calendar";
import type { InboundContent } from "@/lib/antidotes/inbound/queries";
import { GENERATED_POST_FORMAT_LABELS, type GeneratedPost } from "@/lib/antidotes/types";
import { cn } from "@/lib/utils";

/**
 * Le mois — la même grille que le planning éditorial d'un client, et pour la
 * même raison : c'est là qu'on voit les trous.
 *
 * Deux natures s'y croisent. Ce qui a été relevé se pose à sa date de
 * publication, en gris : c'est le rythme des autres. Ce qui est de moi —
 * brouillon daté, post publié — se pose **en vert**, avec la marque du réseau
 * où il partira. Un clic ouvre le même panneau que le tableau.
 *
 * Les jours sont calculés en UTC (`calendar.ts`) ; l'heure d'un post
 * s'affiche en heure de Paris, parce que c'est celle qu'on lit.
 */

const PARIS_TIME = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

type Entry =
  | { kind: "content"; id: string; day: string; entry: InboundContent }
  | { kind: "draft"; id: string; day: string; draft: GeneratedPost };

export function InboundCalendar({
  month,
  contents,
  drafts,
  now,
}: {
  month: string;
  contents: InboundContent[];
  drafts: GeneratedPost[];
  /** L'instant de la lecture serveur : le jour surligné doit être le même au
      rendu serveur et après hydratation. */
  now: number;
}) {
  const { go } = useInboundUrl();
  const grid = useMemo(() => buildCalendarMonth(month), [month]);

  const byDay = useMemo(() => {
    const map = new Map<string, Entry[]>();
    const push = (entry: Entry) => {
      const bucket = map.get(entry.day);
      if (bucket) bucket.push(entry);
      else map.set(entry.day, [entry]);
    };
    for (const content of contents) {
      const at = content.post.published_at;
      if (at) push({ kind: "content", id: content.post.id, day: at.slice(0, 10), entry: content });
    }
    for (const draft of drafts) {
      const at = draft.published_at ?? draft.scheduled_at;
      if (at) push({ kind: "draft", id: draft.id, day: at.slice(0, 10), draft });
    }
    /* Ce qui est de moi passe en tête de la journée : c'est ce qu'on vient
       vérifier, la veille n'est que le décor. */
    for (const bucket of map.values()) {
      bucket.sort((a, b) => Number(b.kind === "draft") - Number(a.kind === "draft"));
    }
    return map;
  }, [contents, drafts]);

  const undated = useMemo(
    () => drafts.filter((draft) => !draft.scheduled_at && !draft.published_at && draft.status !== "rejected"),
    [drafts],
  );

  const today = new Date(now).toISOString().slice(0, 10);
  const openContent = (id: string) => go({ post: id, brouillon: null });
  const openDraft = (draft: GeneratedPost) =>
    draft.source_post_id
      ? go({ post: draft.source_post_id, brouillon: null })
      : go({ brouillon: draft.id, post: null });

  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader
          title={grid.label}
          action={
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Mois précédent"
                onClick={() => go({ mois: grid.previous })}
              >
                <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden />
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => go({ mois: monthKeyOf(new Date(now)) })}>
                Aujourd&apos;hui
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Mois suivant"
                onClick={() => go({ mois: grid.next })}
              >
                <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
              </Button>
            </div>
          }
        />
        <div className="overflow-x-auto">
          <div className="min-w-[44rem] p-5">
            <div className="grid grid-cols-7 gap-px">
              {WEEKDAY_LABELS.map((label) => (
                <p key={label} className="type-overline px-2 pb-2 text-text-secondary">
                  {label}
                </p>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md bg-border-strong">
              {grid.weeks.flat().map((day) => {
                const items = byDay.get(day.date) ?? [];
                return (
                  <div
                    key={day.date}
                    className={cn(
                      "min-h-28 bg-surface p-1.5",
                      !day.inMonth && "bg-surface-sunken",
                      day.date === today && "ring-1 ring-inset ring-accent-ink",
                    )}
                  >
                    <p
                      className={cn(
                        // Jamais `--text-tertiary` sur du texte : 2,67:1, mesuré
                        // à l'audit. Le fond creux dit déjà « hors du mois ».
                        "type-caption px-1 text-text-secondary tabular-nums",
                        day.date === today && "font-medium text-accent-ink",
                      )}
                    >
                      {day.day}
                    </p>
                    <ul className="mt-1 space-y-1">
                      {items.slice(0, 4).map((item) => (
                        <li key={item.id}>
                          {item.kind === "draft" ? (
                            <DraftCell draft={item.draft} onOpen={() => openDraft(item.draft)} />
                          ) : (
                            <ContentCell entry={item.entry} onOpen={() => openContent(item.id)} />
                          )}
                        </li>
                      ))}
                      {items.length > 4 ? (
                        <li className="type-caption px-1.5 text-text-secondary">+ {items.length - 4}</li>
                      ) : null}
                    </ul>
                  </div>
                );
              })}
            </div>
            <p className="type-caption mt-3 flex flex-wrap items-center gap-4 text-text-secondary">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-1.5 rounded-pill bg-[var(--ordinal-1)]" />
                Ce qui est de moi
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-1.5 rounded-pill bg-border-strong" />
                Ce que la veille a relevé
              </span>
            </p>
          </div>
        </div>
      </Panel>

      {undated.length > 0 ? (
        <Panel>
          <PanelHeader title="Sans date" count={undated.length} description="À poser dans le mois" />
          <PanelBody className="flex flex-wrap gap-2">
            {undated.map((draft) => (
              <button
                key={draft.id}
                type="button"
                onClick={() => openDraft(draft)}
                className="focus-visible:ring-ring max-w-xs rounded-md border border-border bg-surface px-3 py-2 text-left transition-colors duration-(--motion-duration) ease-standard hover:bg-muted focus-visible:ring-2 focus-visible:outline-none"
              >
                <span className="type-caption block text-text-secondary">
                  {GENERATED_POST_FORMAT_LABELS[draft.format]}
                </span>
                <span className="type-caption line-clamp-2 text-text-primary">{draft.topic ?? draft.content}</span>
              </button>
            ))}
          </PanelBody>
        </Panel>
      ) : null}
    </div>
  );
}

function DraftCell({ draft, onOpen }: { draft: GeneratedPost; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="focus-visible:ring-ring w-full rounded-sm bg-accent-subtle p-1.5 text-left transition-colors duration-(--motion-duration) ease-standard hover:bg-muted focus-visible:ring-2 focus-visible:outline-none"
    >
      <span className="type-caption flex items-center gap-1.5 text-accent-ink">
        <span aria-hidden className="size-1.5 shrink-0 rounded-pill bg-[var(--ordinal-1)]" />
        <span className="truncate">
          {draft.published_at
            ? "Publié"
            : draft.scheduled_at
              ? PARIS_TIME.format(new Date(draft.scheduled_at))
              : ""}
          {" · "}
          {GENERATED_POST_FORMAT_LABELS[draft.format]}
        </span>
      </span>
      <span className="type-caption mt-0.5 line-clamp-2 text-text-primary">{draft.topic ?? draft.content}</span>
    </button>
  );
}

function ContentCell({ entry, onOpen }: { entry: InboundContent; onOpen: () => void }) {
  const text = entry.post.transcript?.trim() || entry.post.content;
  const mine = entry.post.is_mine;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "focus-visible:ring-ring w-full rounded-sm p-1.5 text-left transition-colors duration-(--motion-duration) ease-standard hover:bg-muted focus-visible:ring-2 focus-visible:outline-none",
        // La légende dit « ce qui est de moi » en vert : un de mes posts déjà
        // publié en est, au même titre qu'un brouillon daté.
        mine ? "bg-accent-subtle" : "bg-surface-sunken",
      )}
    >
      <span className={cn("type-caption flex items-center gap-1.5", mine ? "text-accent-ink" : "text-text-secondary")}>
        <PlatformChip platform={entry.post.platform} mine={mine} className="size-4" />
        <span className="truncate">{entry.account?.label ?? entry.post.author_handle ?? ""}</span>
      </span>
      <span className="type-caption mt-0.5 line-clamp-2 text-text-primary">{text}</span>
    </button>
  );
}
