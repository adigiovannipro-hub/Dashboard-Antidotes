"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { formatDuration, formatValue } from "@/lib/format";
import { heatmapBackground, performanceRank } from "@/lib/viz/palette";
import { cn } from "@/lib/utils";
import type { WebPageRow } from "@/lib/web/data";

/**
 * Le tableau Top Pages — même grammaire que le détail par publication :
 * colonnes triables au clic, heatmap divergente, ligne de total en pied.
 *
 * Seuls les deux **taux** sont teintés : un rebond bas et une session longue
 * se félicitent, mais colorer les volumes accuserait chaque petite page —
 * une page de mentions légales n'est pas « mauvaise » parce qu'elle fait
 * moins de vues que l'accueil.
 */

type Column = {
  key: string;
  header: string;
  kind: "integer" | "percent" | "duration";
  value: (row: WebPageRow) => number | null;
  /** Teinté par la heatmap — et dans quel sens une valeur basse est bonne. */
  shaded?: { lowerIsBetter: boolean };
};

const COLUMNS: Column[] = [
  { key: "views", header: "Vues", kind: "integer", value: (row) => row.views },
  { key: "sessions", header: "Sessions", kind: "integer", value: (row) => row.sessions },
  {
    key: "bounce",
    header: "Taux de rebond",
    kind: "percent",
    value: (row) => row.bounceRate,
    shaded: { lowerIsBetter: true },
  },
  {
    key: "duration",
    header: "Durée moyenne de session",
    kind: "duration",
    value: (row) => row.averageSeconds,
    shaded: { lowerIsBetter: false },
  },
];

function render(column: Column, value: number | null): string {
  if (column.kind === "duration") return formatDuration(value);
  if (column.kind === "percent") return formatValue(value, "percent");
  return formatValue(value, "integer");
}

export function WebPagesTable({
  pages,
  total,
}: {
  pages: readonly WebPageRow[];
  total: WebPageRow;
}) {
  const [sort, setSort] = useState<{ key: string; desc: boolean }>({
    key: "views",
    desc: true,
  });

  const sorted = useMemo(() => {
    const column = COLUMNS.find((candidate) => candidate.key === sort.key);
    if (!column) return [...pages];
    const factor = sort.desc ? -1 : 1;
    return [...pages].sort((a, b) => {
      const left = column.value(a);
      const right = column.value(b);
      // Une valeur indéfinie tombe en bas, quel que soit le sens du tri.
      if (left === null && right === null) return 0;
      if (left === null) return 1;
      if (right === null) return -1;
      return (left - right) * factor;
    });
  }, [pages, sort]);

  // Les échelles de heatmap se calculent sur les lignes affichées.
  const columnValues = useMemo(
    () =>
      Object.fromEntries(
        COLUMNS.map((column) => [
          column.key,
          sorted
            .map((row) => column.value(row))
            .filter((value): value is number => value !== null),
        ]),
      ) as Record<string, number[]>,
    [sorted],
  );

  if (pages.length === 0) {
    return (
      <p className="text-text-secondary type-body">Aucune page lue sur la période.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max text-xs">
        <caption className="sr-only">
          Pages du site, triées par{" "}
          {COLUMNS.find((column) => column.key === sort.key)?.header}
          {sort.desc ? ", décroissant" : ", croissant"}.
        </caption>
        <thead>
          <tr className="text-muted-foreground text-left">
            <th scope="col" className="px-2 pb-2 font-medium">
              Chemin de la page
            </th>
            {COLUMNS.map((column) => {
              const isSorted = sort.key === column.key;
              return (
                <th
                  key={column.key}
                  scope="col"
                  className="pb-2 font-medium"
                  aria-sort={
                    isSorted ? (sort.desc ? "descending" : "ascending") : "none"
                  }
                >
                  <button
                    type="button"
                    onClick={() =>
                      setSort((current) =>
                        current.key === column.key
                          ? { key: column.key, desc: !current.desc }
                          : { key: column.key, desc: true },
                      )
                    }
                    className={cn(
                      "hover:text-foreground focus-visible:ring-brand flex w-full items-center justify-end gap-0.5 rounded px-2 py-1 transition-colors focus-visible:ring-2 focus-visible:outline-none",
                      isSorted && "text-foreground",
                    )}
                  >
                    {column.header}
                    {isSorted ? (
                      sort.desc ? (
                        <ArrowDown className="size-3" aria-hidden />
                      ) : (
                        <ArrowUp className="size-3" aria-hidden />
                      )
                    ) : null}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {sorted.map((row) => (
            <tr key={row.path} className="border-t border-[var(--viz-grid)]">
              <th scope="row" className="px-2 py-2 text-left font-normal">
                <span className="block max-w-[24rem] truncate" title={row.path}>
                  {row.path}
                </span>
              </th>
              {COLUMNS.map((column) => {
                const value = column.value(row);
                const rank =
                  column.shaded && value !== null
                    ? performanceRank(
                        value,
                        columnValues[column.key] ?? [],
                        column.shaded.lowerIsBetter,
                      )
                    : 0;
                return (
                  <td
                    key={column.key}
                    className="px-2 py-2 text-right tabular-nums"
                    style={
                      column.shaded && value !== null
                        ? { backgroundColor: heatmapBackground(rank) }
                        : undefined
                    }
                  >
                    {render(column, value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>

        <tfoot>
          <tr className="border-t-2 border-[var(--viz-axis)] font-semibold">
            <th scope="row" className="px-2 pt-2 text-left">
              Total général
            </th>
            {COLUMNS.map((column) => (
              <td key={column.key} className="px-2 pt-2 text-right tabular-nums">
                {render(column, column.value(total))}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
