"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PenLine } from "lucide-react";
import { toast } from "sonner";

import { saveContextField } from "@/app/actions/context";
import type { ContextTextField } from "@/lib/context/types";
import { cn } from "@/lib/utils";

/**
 * Une carte de champ texte, éditable en place : clic pour ouvrir, sauvegarde
 * au blur, Échap pour renoncer. Pas de modale — le brief se corrige comme on
 * annote un document.
 */
export function BriefFieldCard({
  workspaceSlug,
  field,
  label,
  hint,
  value,
  minHeightClass,
  readOnly,
  editHint,
  className,
}: {
  workspaceSlug: string;
  field: ContextTextField;
  label: string;
  hint?: string;
  value: string;
  minHeightClass: string;
  readOnly: boolean;
  editHint: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [, startSave] = useTransition();
  // Échap ferme sans sauver : le blur qui suit ne doit pas écrire non plus.
  const cancelled = useRef(false);

  function open() {
    if (readOnly || editing) return;
    setDraft(value);
    cancelled.current = false;
    setEditing(true);
  }

  function commit(next: string) {
    setEditing(false);
    if (cancelled.current) return;
    if (next.trim() === value.trim()) return;

    startSave(async () => {
      const outcome = await saveContextField(
        { workspace: workspaceSlug },
        { field, value: next },
      );
      if (!outcome.ok) {
        toast.error(outcome.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-surface p-5 shadow-card transition-[border-color,box-shadow] duration-(--motion-duration) ease-standard",
        !readOnly && "cursor-text hover:border-border-strong",
        editHint && !readOnly && "border-dashed border-border-strong",
        className,
      )}
      onClick={open}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="type-overline text-text-secondary">{label}</p>
        {!readOnly ? (
          <PenLine
            aria-hidden
            strokeWidth={1.75}
            className={cn(
              "size-4 shrink-0 text-text-tertiary transition-opacity duration-(--motion-duration) ease-standard",
              editHint || editing ? "opacity-100" : "opacity-0",
            )}
          />
        ) : null}
      </div>
      {hint ? <p className="type-caption mt-0.5 text-text-secondary">{hint}</p> : null}

      {editing ? (
        <textarea
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              cancelled.current = true;
              setEditing(false);
            }
          }}
          aria-label={label}
          className={cn(
            "focus-visible:ring-ring mt-3 w-full resize-y rounded-md border border-border-line bg-surface px-3 py-2 type-body text-text-primary focus-visible:ring-2 focus-visible:outline-none",
            minHeightClass,
          )}
        />
      ) : (
        <div className={cn("mt-3", minHeightClass)}>
          {value.trim() ? (
            <p className="type-body whitespace-pre-wrap text-text-primary">{value}</p>
          ) : (
            <p className="type-body text-text-secondary">
              {readOnly ? "—" : "Cliquer pour renseigner."}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
