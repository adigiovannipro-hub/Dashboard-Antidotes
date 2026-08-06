"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Search } from "lucide-react";

import { StatusPill } from "@/components/ds/status-pill";
import { Panel, PanelHeader } from "@/components/ds/surface";
import { Input } from "@/components/ui/input";
import { needsRework } from "@/lib/moderation/faq-search";
import { directValidationRate } from "@/lib/moderation/learning";
import type { FaqEntry } from "@/lib/moderation/types";
import { cn } from "@/lib/utils";

/**
 * Écran FAQ : la base, ses statistiques, et surtout ce qui est à retravailler.
 *
 * Le classement met d'abord les entrées souvent corrigées. Une FAQ n'est utile
 * que si l'on sait laquelle de ses entrées produit de mauvaises réponses — la
 * liste alphabétique ne le dit pas.
 */
export function FaqTable({
  entries,
  categories,
  highlightId,
  canEdit,
}: {
  entries: FaqEntry[];
  categories: { id: string; name: string }[];
  highlightId: string | null;
  canEdit: boolean;
}) {
  const [query, setQuery] = useState("");
  const [reworkOnly, setReworkOnly] = useState(false);

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries
      .filter((entry) => {
        if (reworkOnly && !needsRework(entry)) return false;
        if (!needle) return true;
        return (
          entry.question_canonical.toLowerCase().includes(needle) ||
          entry.variants.some((variant) => variant.toLowerCase().includes(needle)) ||
          (entry.answer_fr ?? "").toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => {
        // À retravailler d'abord, puis les plus utilisées.
        const rework = Number(needsRework(b)) - Number(needsRework(a));
        if (rework !== 0) return rework;
        return b.usage_count - a.usage_count;
      });
  }, [entries, query, reworkOnly]);

  const reworkCount = entries.filter(needsRework).length;

  return (
    <Panel>
      <PanelHeader
        title="Entrées"
        count={rows.length}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-56">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-tertiary"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher…"
                aria-label="Rechercher dans la FAQ"
                className="pl-9"
              />
            </div>

            <label className="type-label flex items-center gap-2 text-text-primary">
              <input
                type="checkbox"
                checked={reworkOnly}
                onChange={(event) => setReworkOnly(event.target.checked)}
                className="accent-brand size-4"
              />
              À retravailler
              {reworkCount > 0 ? (
                <StatusPill tone="danger" dot={false}>
                  {reworkCount}
                </StatusPill>
              ) : null}
            </label>
          </div>
        }
      />

      <div className="overflow-x-auto p-5 pt-4">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="text-muted-foreground border-b border-[var(--viz-grid)] text-left text-xs">
              <th scope="col" className="px-2 pb-2 font-medium">Question canonique</th>
              <th scope="col" className="px-2 pb-2 font-medium">Catégorie</th>
              <th scope="col" className="px-2 pb-2 font-medium">Langues</th>
              <th scope="col" className="px-2 pb-2 text-right font-medium">Variantes</th>
              <th scope="col" className="px-2 pb-2 text-right font-medium">Utilisations</th>
              <th scope="col" className="px-2 pb-2 text-right font-medium">Validation directe</th>
              <th scope="col" className="px-2 pb-2 text-right font-medium">Corrections</th>
              <th scope="col" className="px-2 pb-2 text-right font-medium">Confiance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => {
              const rework = needsRework(entry);
              const rate = directValidationRate(entry);
              return (
                <tr
                  key={entry.id}
                  id={entry.id}
                  className={cn(
                    "border-b border-[var(--viz-grid)]",
                    entry.id === highlightId && "bg-brand-mint",
                  )}
                >
                  <th scope="row" className="max-w-sm px-2 py-2 text-left font-normal">
                    <span className="flex items-start gap-1.5">
                      {rework ? (
                        <AlertTriangle
                          className="text-danger-ink mt-0.5 size-3.5 shrink-0"
                          aria-label="À retravailler"
                        />
                      ) : null}
                      <span>
                        {entry.question_canonical}
                        {!entry.active ? (
                          <span className="text-muted-foreground ml-2 text-xs">
                            (inactive)
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </th>
                  <td className="text-muted-foreground px-2 py-2">
                    {entry.category_id ? categoryNames.get(entry.category_id) : "—"}
                  </td>
                  <td className="text-muted-foreground px-2 py-2">
                    {[entry.answer_fr ? "FR" : null, entry.answer_en ? "EN" : null]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {entry.variants.length}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {entry.usage_count}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {rate === null ? "—" : `${Math.round(rate * 100)} %`}
                  </td>
                  <td
                    className={cn(
                      "px-2 py-2 text-right tabular-nums",
                      entry.correction_count > 0 && rework && "text-danger-ink font-medium",
                    )}
                  >
                    {entry.correction_count}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {Math.round(entry.confidence * 100)} %
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <p className="type-body py-8 text-center text-text-secondary">
          Aucune entrée ne correspond.
        </p>
      ) : null}

      <p className="type-caption border-t border-border bg-surface-sunken px-5 py-3 text-text-secondary">
        Une entrée est signalée « à retravailler » dès qu&apos;un tiers de ses
        utilisations finit en correction, ou que sa confiance passe sous 60 %.
        {canEdit
          ? " L'édition et l'import CSV arrivent avec la connexion des canaux."
          : " Votre rôle est en lecture seule."}
      </p>
    </Panel>
  );
}
