"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { saveSourcedFacts } from "@/app/actions/context";
import { Button } from "@/components/ui/button";
import { isFactStale, SOURCED_FACT_STALE_DAYS } from "@/lib/context/freshness";
import { safeAction } from "@/lib/context/safe-action";
import type { SourcedFact } from "@/lib/context/types";
import { cn } from "@/lib/utils";

/**
 * Les faits vérifiés : le seul endroit d'où un chiffre a le droit de sortir.
 *
 * La date est un champ `date` et non un texte libre — c'est ce qui permet de
 * comparer à six mois. Passé ce délai, la ligne porte son marqueur : le fait
 * continue de partir dans les prompts (c'est une matière, pas une consigne)
 * mais annoncé comme à revérifier, pour que le modèle n'en fasse pas une
 * affirmation du jour.
 */
export function SourcedFactsEditor({
  workspaceSlug,
  facts,
  readOnly,
}: {
  workspaceSlug: string;
  facts: SourcedFact[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<SourcedFact[]>(facts);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(facts));
  const [, startSave] = useTransition();
  const now = new Date();

  function persist(next: SourcedFact[]) {
    const json = JSON.stringify(next);
    if (json === savedJson) return;

    startSave(async () => {
      const outcome = await safeAction(() =>
        saveSourcedFacts({ workspace: workspaceSlug }, { facts: next }),
      );
      if (!outcome.ok) {
        toast.error(outcome.error);
        return;
      }
      setSavedJson(json);
      router.refresh();
    });
  }

  function update(index: number, patch: Partial<SourcedFact>) {
    setDrafts((current) =>
      current.map((fact, i) => (i === index ? { ...fact, ...patch } : fact)),
    );
  }

  function remove(index: number) {
    const next = drafts.filter((_, i) => i !== index);
    setDrafts(next);
    persist(next);
  }

  return (
    <div className="flex flex-col gap-3">
      {drafts.length === 0 ? (
        <p className="type-body text-text-secondary">
          {readOnly ? "—" : "Un fait, sa source, la date de vérification."}
        </p>
      ) : null}

      {drafts.map((fact, index) => {
        const stale = isFactStale(fact.verifie_le, now);
        return (
          <div
            key={index}
            className={cn(
              "flex flex-col gap-2 rounded-md border p-3",
              stale ? "border-warning bg-warning-subtle" : "border-border-line",
            )}
          >
            <div className="flex items-start gap-2">
              <textarea
                value={fact.fait}
                disabled={readOnly}
                rows={2}
                placeholder="Le fait, tel qu'il peut être écrit."
                aria-label={`Fait ${index + 1}`}
                onChange={(event) => update(index, { fait: event.target.value })}
                onBlur={() => persist(drafts)}
                className="focus-visible:ring-ring flex-1 resize-y rounded-md border border-border-line bg-surface px-3 py-2 type-caption text-text-primary focus-visible:ring-2 focus-visible:outline-none"
              />
              {!readOnly ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Retirer le fait ${index + 1}`}
                  onClick={() => remove(index)}
                >
                  <Trash2 aria-hidden strokeWidth={1.75} />
                </Button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                value={fact.source}
                disabled={readOnly}
                placeholder="Source ou URL"
                aria-label={`Source du fait ${index + 1}`}
                onChange={(event) => update(index, { source: event.target.value })}
                onBlur={() => persist(drafts)}
                className="focus-visible:ring-ring h-9 min-w-0 flex-1 rounded-md border border-border-line bg-surface px-3 type-caption text-text-primary focus-visible:ring-2 focus-visible:outline-none"
              />
              <input
                type="date"
                value={fact.verifie_le}
                disabled={readOnly}
                aria-label={`Date de vérification du fait ${index + 1}`}
                onChange={(event) => update(index, { verifie_le: event.target.value })}
                onBlur={() => persist(drafts)}
                className="focus-visible:ring-ring h-9 shrink-0 rounded-md border border-border-line bg-surface px-3 type-caption text-text-primary focus-visible:ring-2 focus-visible:outline-none"
              />
            </div>

            {stale ? (
              <p className="type-caption flex items-center gap-1.5 text-warning-ink">
                <AlertTriangle aria-hidden strokeWidth={1.75} className="size-3.5 shrink-0" />
                Vérifié il y a plus de {SOURCED_FACT_STALE_DAYS} jours.
              </p>
            ) : null}
          </div>
        );
      })}

      {!readOnly ? (
        <div>
          <Button
            size="sm"
            variant="outline"
            data-icon="inline-start"
            onClick={() =>
              setDrafts((current) => [
                ...current,
                { fait: "", source: "", verifie_le: new Date().toISOString().slice(0, 10) },
              ])
            }
          >
            <Plus aria-hidden strokeWidth={1.75} />
            Ajouter un fait
          </Button>
        </div>
      ) : null}
    </div>
  );
}
