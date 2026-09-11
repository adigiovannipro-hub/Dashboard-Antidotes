"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { saveContextField } from "@/app/actions/context";
import { safeAction } from "@/lib/context/safe-action";
import type { ContextTextField } from "@/lib/context/types";

/**
 * Un champ texte du brief, sauvegardé au blur.
 *
 * Il était auparavant une carte qu'il fallait cliquer pour ouvrir, avec un
 * bouton « Modifier » en tête de page pour rendre l'affordance visible — deux
 * gestes pour écrire une phrase. Le repli des blocs ayant pris le relais (un
 * bloc ouvert est un bloc qu'on vient remplir), le champ est directement
 * saisissable et la carte disparaît : c'est `BriefBlock` qui porte le cadre.
 */
export function BriefField({
  workspaceSlug,
  field,
  label,
  value,
  rows,
  readOnly,
}: {
  workspaceSlug: string;
  field: ContextTextField;
  label: string;
  value: string;
  rows: number;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(value);
  const [, startSave] = useTransition();

  function commit() {
    if (readOnly) return;
    if (draft.trim() === value.trim()) return;

    startSave(async () => {
      const outcome = await safeAction(() =>
        saveContextField({ workspace: workspaceSlug }, { field, value: draft }),
      );
      if (!outcome.ok) {
        toast.error(outcome.error);
        return;
      }
      router.refresh();
    });
  }

  if (readOnly) {
    return value.trim() ? (
      <p className="type-body whitespace-pre-wrap text-text-primary">{value}</p>
    ) : (
      <p className="type-body text-text-secondary">—</p>
    );
  }

  return (
    <textarea
      value={draft}
      rows={rows}
      aria-label={label}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      className="focus-visible:ring-ring w-full resize-y rounded-md border border-border-line bg-surface px-3 py-2 type-body text-text-primary focus-visible:ring-2 focus-visible:outline-none"
    />
  );
}
