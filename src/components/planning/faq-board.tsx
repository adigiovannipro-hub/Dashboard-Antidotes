"use client";

import { Plus } from "lucide-react";

import {
  createFaqEntry,
  deleteFaqEntry,
  updateFaqEntry,
} from "@/app/actions/planning";
import { DeleteRowButton, TextCell, useCellAction } from "@/components/planning/cells";
import type { Scope } from "@/components/planning/subject-row";
import type { FaqEntry, PlanningBoard } from "@/lib/planning/types";
import { cn } from "@/lib/utils";

/**
 * Le second tableau de la section : la FAQ du client.
 *
 * Il vit à côté du planning sans rien partager avec lui, exactement comme les
 * deux boards Monday. Le module Modération l'enrichit à chaque correction — une
 * entrée marquée `moderation` vient de là — mais rien de la Modération n'est
 * visible ici : le client voit sa FAQ, pas la boîte de réception qui l'alimente.
 */
const FAQ_GRID =
  "grid grid-cols-[minmax(200px,1.2fr)_140px_minmax(260px,2fr)_90px_28px] items-start gap-x-2";

export function FaqBoardView({
  scope,
  board,
  entries,
}: {
  scope: Scope;
  board: PlanningBoard;
  entries: FaqEntry[];
}) {
  const { run, pending } = useCellAction();

  return (
    <div className="min-w-0 flex-1 p-4 md:p-6">
      <header className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-lg font-semibold tracking-tight">{board.name}</h1>
        <p className="text-muted-foreground text-xs tabular-nums">
          {entries.length} entrée{entries.length > 1 ? "s" : ""} · enrichie par la
          Modération
        </p>
      </header>

      <div className="border-border overflow-hidden rounded-md border">
        <div
          className={cn(
            "border-border bg-card/60 text-muted-foreground border-b px-2 py-1.5 text-[10px] font-medium tracking-wide uppercase",
            FAQ_GRID,
          )}
        >
          <span className="px-1.5">Question</span>
          <span className="px-1.5">Catégorie</span>
          <span className="px-1.5">Réponse</span>
          <span className="px-1.5">Origine</span>
          <span />
        </div>

        {entries.length === 0 ? (
          <p className="text-muted-foreground px-3 py-8 text-center text-sm">
            Aucune entrée. La FAQ se remplit à la main, ou toute seule quand la
            Modération corrige une réponse.
          </p>
        ) : (
          entries.map((entry) => (
            <FaqRow key={entry.id} scope={scope} entry={entry} />
          ))
        )}

        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => createFaqEntry(scope, { boardId: board.id }))}
          className="text-muted-foreground hover:text-foreground hover:bg-muted/40 focus-visible:ring-ring flex w-full items-center gap-1.5 px-3 py-2 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <Plus className="size-3.5" aria-hidden />
          Ajouter une entrée
        </button>
      </div>
    </div>
  );
}

function FaqRow({ scope, entry }: { scope: Scope; entry: FaqEntry }) {
  const { run, pending } = useCellAction();

  return (
    <div
      className={cn(
        "group/row border-border/60 hover:bg-muted/40 border-b px-2 py-1.5 transition-colors",
        FAQ_GRID,
        pending && "opacity-60",
      )}
    >
      <TextCell
        value={entry.question}
        ariaLabel="Question"
        placeholder="Nouvelle question…"
        className="font-medium"
        onCommit={(next) =>
          run(() =>
            updateFaqEntry(scope, { entryId: entry.id, field: "question", value: next }),
          )
        }
      />

      <TextCell
        value={entry.category ?? ""}
        ariaLabel="Catégorie"
        placeholder="—"
        onCommit={(next) =>
          run(() =>
            updateFaqEntry(scope, {
              entryId: entry.id,
              field: "category",
              value: next || null,
            }),
          )
        }
      />

      <textarea
        defaultValue={entry.answer ?? ""}
        rows={2}
        aria-label="Réponse"
        placeholder="La réponse de référence."
        onBlur={(event) => {
          const next = event.target.value.trim();
          if (next === (entry.answer ?? "").trim()) return;
          run(() =>
            updateFaqEntry(scope, {
              entryId: entry.id,
              field: "answer",
              value: next || null,
            }),
          );
        }}
        className="focus-visible:ring-brand w-full resize-y rounded-sm bg-transparent px-1.5 py-1 text-sm outline-none focus-visible:ring-2"
      />

      <span
        className="text-muted-foreground px-1.5 py-1 text-[11px]"
        title={
          entry.source === "moderation"
            ? "Créée par la boucle de correction de la Modération"
            : "Saisie à la main"
        }
      >
        {entry.source === "moderation" ? "Modération" : "Manuelle"}
      </span>

      <DeleteRowButton
        label={entry.question || "cette entrée"}
        onDelete={() => run(() => deleteFaqEntry(scope, { entryId: entry.id }))}
      />
    </div>
  );
}
