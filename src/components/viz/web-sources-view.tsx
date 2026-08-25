"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCompact, formatValue } from "@/lib/format";
import { seriesColor } from "@/lib/viz/palette";
import type { SourcesByMonth } from "@/lib/web/data";

/**
 * L'histogramme empilé des sources de trafic, mois par mois — la barre du
 * rapport Looker. Les teintes suivent le rang des sources sur toute la
 * fenêtre, jamais le mois : « tiktok » garde sa couleur d'une barre à
 * l'autre. « Autres » est le repli de la palette, en gris hors échelle.
 *
 * Un liseré de la couleur de surface sépare les segments empilés : c'est le
 * blanc qui découpe, jamais un contour.
 */
export function WebSourcesView({
  data,
  height = 260,
}: {
  data: SourcesByMonth;
  height?: number;
}) {
  const rows = data.months.map((month) => ({ label: month.label, ...month.values }));

  const colorOf = (source: string, index: number) =>
    source === "Autres" ? "var(--viz-axis)" : seriesColor(index);

  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--viz-grid)" strokeWidth={1} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--viz-muted)", fontSize: 11 }}
              stroke="var(--viz-axis)"
              tickLine={false}
              axisLine={{ stroke: "var(--viz-axis)" }}
            />
            <YAxis
              tick={{ fill: "var(--viz-muted)", fontSize: 11 }}
              tickFormatter={(value: number) => formatCompact(value)}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              cursor={{ fill: "var(--viz-grid)", opacity: 0.5 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="bg-background border-border rounded-md border px-2.5 py-1.5 text-xs shadow-sm">
                    <p className="text-muted-foreground">{String(label)}</p>
                    {[...payload].reverse().map((entry) => (
                      <p key={String(entry.dataKey)} className="flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className="size-2 rounded-full"
                          style={{ backgroundColor: String(entry.color) }}
                        />
                        <span className="text-foreground">{String(entry.dataKey)}</span>
                        <span className="text-foreground ml-auto pl-3 font-semibold tabular-nums">
                          {formatValue(Number(entry.value ?? 0), "integer")}
                        </span>
                      </p>
                    ))}
                  </div>
                );
              }}
            />
            {data.sources.map((source, index) => (
              <Bar
                key={source}
                dataKey={source}
                stackId="sessions"
                fill={colorOf(source, index)}
                stroke="var(--viz-surface)"
                strokeWidth={1}
                maxBarSize={48}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Légende : l'identité ne repose jamais sur la seule couleur. */}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {data.sources.map((source, index) => (
          <li key={source} className="flex items-center gap-1.5 text-xs">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: colorOf(source, index) }}
            />
            <span className="text-foreground">{source}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Vue tableau jumelle — l'équivalent accessible du même jeu de données. */
export function WebSourcesTable({ data }: { data: SourcesByMonth }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground text-left">
            <th scope="col" className="pb-2 font-medium">
              Mois
            </th>
            {data.sources.map((source) => (
              <th key={source} scope="col" className="pb-2 text-right font-medium">
                {source}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.months.map((month) => (
            <tr key={month.month} className="border-t border-[var(--viz-grid)]">
              <th scope="row" className="py-1.5 text-left font-normal">
                {month.label}
              </th>
              {data.sources.map((source) => (
                <td key={source} className="py-1.5 text-right tabular-nums">
                  {formatValue(month.values[source] ?? 0, "integer")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
