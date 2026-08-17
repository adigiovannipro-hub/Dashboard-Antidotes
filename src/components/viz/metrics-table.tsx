"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { formatMetric } from "@/lib/format";
import { computeMetric, METRIC_DEFINITIONS } from "@/lib/metrics/definitions";
import type { ClickAttributionMode, MetricId, RawMetrics } from "@/lib/metrics/types";
import { heatmapBackground, performanceRank } from "@/lib/viz/palette";
import { cn } from "@/lib/utils";

export interface MetricsTableRow {
  id: string;
  campaign: string;
  adSet: string;
  raw: RawMetrics;
}

/**
 * Libellés raccourcis pour l'en-tête du tableau, où la place manque.
 *
 * Ils reprenaient le rapport Looker, en anglais ; la table est lue par le
 * client, elle est donc en français comme le reste de l'interface. Seule la
 * longueur justifie l'écart avec `METRIC_DEFINITIONS`.
 */
const COLUMN_LABEL_OVERRIDES: Partial<Record<MetricId, string>> = {
  impressions: "Vues",
  spend: "Budget",
  landingPageViews: "Vues page",
};

function columnLabel(metric: MetricId): string {
  return COLUMN_LABEL_OVERRIDES[metric] ?? METRIC_DEFINITIONS[metric].label;
}

/**
 * Tableau dense, une ligne par ad set, avec heatmap conditionnelle par colonne.
 *
 * Deux écarts assumés avec le rapport Looker actuel :
 *
 * 1. **La heatmap est mono-teinte menthe → vert**, pas rouge → blanc → vert.
 *    Le rouge/vert est le pire cas de daltonisme — 8 % des hommes ne lisent pas
 *    la différence — et la charte réserve le rouge au réellement critique. Ici
 *    le vert franc marque la meilleure valeur de la colonne, l'absence de fond
 *    la moins bonne.
 * 2. **Le sens métier est respecté** : sur un CPA ou un CPM, la valeur la plus
 *    basse est la meilleure et se teinte donc en vert. Sur la dépense, aucun
 *    fond — dépenser plus n'est en soi ni bon ni mauvais.
 *
 * La ligne de total est calculée sur les agrégats bruts, jamais en sommant les
 * ratios des lignes.
 */
export function MetricsTable({
  rows,
  columns,
  total,
  mode,
}: {
  rows: readonly MetricsTableRow[];
  columns: readonly MetricId[];
  total: RawMetrics;
  mode: ClickAttributionMode;
}) {
  const [sort, setSort] = useState<{ metric: MetricId; desc: boolean }>({
    metric: "spend",
    desc: true,
  });
  const [query, setQuery] = useState("");

  const computed = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        values: Object.fromEntries(
          columns.map((metric) => [metric, computeMetric(metric, row.raw, mode)]),
        ) as Record<MetricId, number | null>,
      })),
    [rows, columns, mode],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return computed;
    return computed.filter(
      (row) =>
        row.campaign.toLowerCase().includes(needle) ||
        row.adSet.toLowerCase().includes(needle),
    );
  }, [computed, query]);

  const sorted = useMemo(() => {
    const factor = sort.desc ? -1 : 1;
    return [...filtered].sort((a, b) => {
      const left = a.values[sort.metric];
      const right = b.values[sort.metric];
      // Les métriques non définies tombent toujours en bas, quel que soit le sens.
      if (left === null && right === null) return 0;
      if (left === null) return 1;
      if (right === null) return -1;
      return (left - right) * factor;
    });
  }, [filtered, sort]);

  // Échelles de heatmap calculées sur les lignes affichées : filtrer doit
  // recalculer les nuances, sinon la couleur mentirait sur le classement.
  const columnValues = useMemo(
    () =>
      Object.fromEntries(
        columns.map((metric) => [
          metric,
          sorted
            .map((row) => row.values[metric])
            .filter((value): value is number => value !== null),
        ]),
      ) as Record<MetricId, number[]>,
    [columns, sorted],
  );

  return (
    <div className="space-y-3">
      <div className="relative max-w-xs">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filtrer par campagne ou ad set"
          aria-label="Filtrer par campagne ou ad set"
          className="pl-8"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-xs">
          <caption className="sr-only">
            Performance par ad set, triée par {columnLabel(sort.metric)}
            {sort.desc ? ", décroissant" : ", croissant"}.
          </caption>
          <thead>
            <tr className="text-muted-foreground text-left">
              <th scope="col" className="px-2 pb-2 font-medium">
                Campagne
              </th>
              <th scope="col" className="px-2 pb-2 font-medium">
                Ad set
              </th>
              {columns.map((metric) => {
                const isSorted = sort.metric === metric;
                return (
                  <th
                    key={metric}
                    scope="col"
                    className="pb-2 font-medium"
                    // `aria-sort` appartient à l'en-tête de colonne, pas au
                    // bouton : le rôle `button` ne le porte pas.
                    aria-sort={
                      isSorted ? (sort.desc ? "descending" : "ascending") : "none"
                    }
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setSort((current) =>
                          current.metric === metric
                            ? { metric, desc: !current.desc }
                            : { metric, desc: true },
                        )
                      }
                      className={cn(
                        "hover:text-foreground focus-visible:ring-brand flex w-full items-center justify-end gap-0.5 rounded px-2 py-1 transition-colors focus-visible:ring-2 focus-visible:outline-none",
                        isSorted && "text-foreground",
                      )}
                    >
                      {columnLabel(metric)}
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
              <tr key={row.id} className="border-t border-[var(--viz-grid)]">
                <th
                  scope="row"
                  className="max-w-[13rem] truncate px-2 py-2 text-left font-normal"
                  title={row.campaign}
                >
                  {row.campaign}
                </th>
                <td
                  className="text-muted-foreground max-w-[11rem] truncate px-2 py-2"
                  title={row.adSet}
                >
                  {row.adSet}
                </td>
                {columns.map((metric) => {
                  const value = row.values[metric];
                  const definition = METRIC_DEFINITIONS[metric];
                  // La dépense n'est pas une performance : aucun fond.
                  const shaded = metric !== "spend" && value !== null;
                  const position = shaded
                    ? performanceRank(
                        value,
                        columnValues[metric],
                        definition.direction === "down-good",
                      )
                    : 0;

                  return (
                    <td
                      key={metric}
                      className="px-2 py-2 text-right"
                      style={
                        shaded
                          ? { backgroundColor: heatmapBackground(position) }
                          : undefined
                      }
                    >
                      {formatMetric(metric, value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr className="border-t-2 border-[var(--viz-axis)] font-semibold">
              <th scope="row" colSpan={2} className="px-2 pt-2 text-left">
                Total général
              </th>
              {columns.map((metric) => (
                <td key={metric} className="px-2 pt-2 text-right">
                  {formatMetric(metric, computeMetric(metric, total, mode))}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-muted-foreground text-xs">
        Fond vert&nbsp;: les meilleures valeurs de la colonne ; fond
        rouge&nbsp;: les moins bonnes. Le sens métier est respecté — sur un CPA
        ou un CPM, la valeur la plus basse est la meilleure.
      </p>
    </div>
  );
}
