"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCompact, formatValue } from "@/lib/format";

export interface TrendPoint {
  /** Libellé d'axe déjà formaté (« juin 2026 »). */
  label: string;
  value: number;
}

/**
 * Courbe d'évolution mono-série, avec infobulle au survol.
 *
 * Une seule série, donc **pas de légende** : le titre du bloc dit déjà ce qui
 * est tracé, et une boîte à une pastille ne ferait que répéter le titre.
 * L'étiquette directe se limite au dernier point — un nombre sur chaque point
 * serait illisible.
 */
export function TrendLine({
  data,
  color = "var(--series-1)",
  height = 220,
}: {
  data: readonly TrendPoint[];
  color?: string;
  height?: number;
}) {
  const values = data.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.15, 1);
  const last = data.at(-1);

  return (
    // La hauteur inclut la bande de l'axe des abscisses : sinon la card
    // développe une barre de défilement verticale interne.
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={[...data]} margin={{ top: 16, right: 44, bottom: 4, left: 0 }}>
          {/* Filets pleins d'un pixel, un cran hors surface — jamais pointillés,
              le pointillé se lit comme un seuil ou une projection. */}
          <CartesianGrid
            stroke="var(--viz-grid)"
            strokeWidth={1}
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--viz-muted)", fontSize: 11 }}
            stroke="var(--viz-axis)"
            tickLine={false}
            axisLine={{ stroke: "var(--viz-axis)" }}
          />
          <YAxis
            domain={[Math.floor(min - pad), Math.ceil(max + pad)]}
            tick={{ fill: "var(--viz-muted)", fontSize: 11 }}
            tickFormatter={(value: number) => formatCompact(value)}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            cursor={{ stroke: "var(--viz-axis)", strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="bg-background border-border rounded-md border px-2.5 py-1.5 text-xs shadow-sm">
                  <p className="text-muted-foreground">{String(label)}</p>
                  <p className="text-foreground font-semibold tabular-nums">
                    {formatValue(Number(payload[0]?.value ?? 0), "integer")}
                  </p>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            // Anneau de 2px dans la couleur de surface : le marqueur reste
            // lisible là où il croise la ligne.
            dot={{
              r: 4,
              fill: color,
              stroke: "var(--viz-surface)",
              strokeWidth: 2,
            }}
            activeDot={{
              r: 5,
              fill: color,
              stroke: "var(--viz-surface)",
              strokeWidth: 2,
            }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>

      {last ? (
        <p className="text-muted-foreground -mt-1 text-right text-xs">
          Dernier point&nbsp;:{" "}
          <span className="text-foreground font-semibold tabular-nums">
            {formatValue(last.value, "integer")}
          </span>
        </p>
      ) : null}
    </div>
  );
}

export function TrendLineTable({
  data,
  categoryLabel,
  valueLabel,
}: {
  data: readonly TrendPoint[];
  categoryLabel: string;
  valueLabel: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground text-left">
            <th scope="col" className="pb-2 font-medium">
              {categoryLabel}
            </th>
            <th scope="col" className="pb-2 text-right font-medium">
              {valueLabel}
            </th>
            <th scope="col" className="pb-2 text-right font-medium">
              Variation
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((point, index) => {
            const previous = index > 0 ? data[index - 1]!.value : null;
            const change = previous === null ? null : point.value - previous;
            return (
              <tr key={point.label} className="border-t border-[var(--viz-grid)]">
                <th scope="row" className="py-1.5 text-left font-normal">
                  {point.label}
                </th>
                <td className="py-1.5 text-right">
                  {formatValue(point.value, "integer")}
                </td>
                <td className="text-muted-foreground py-1.5 text-right">
                  {change === null
                    ? "—"
                    : `${change >= 0 ? "+" : "−"}${formatValue(Math.abs(change), "integer")}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
