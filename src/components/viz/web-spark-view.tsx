"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts";

import { formatDuration, formatValue } from "@/lib/format";
import type { WebSparkPoint } from "@/lib/web/data";

export type WebSparkKind = "integer" | "percent" | "duration";

export function formatSparkValue(value: number | null, kind: WebSparkKind): string {
  if (kind === "duration") return formatDuration(value);
  return formatValue(value, kind);
}

/**
 * La double courbe d'une carte de mesure du Site Web : la période en trait
 * plein, la même période un an plus tôt en gris. Pas d'axes — c'est une
 * silhouette de tendance, le chiffre exact vit au-dessus et l'infobulle donne
 * les deux valeurs au survol.
 *
 * Le gris de comparaison n'est pas une teinte de série : c'est la même
 * grandeur, un an avant. Lui donner une couleur de la palette laisserait
 * croire à une seconde mesure.
 */
export function WebSparkView({
  data,
  kind,
  comparisonLabel,
  height = 72,
}: {
  data: readonly WebSparkPoint[];
  kind: WebSparkKind;
  /** « juillet 2025 » — nomme la ligne grise dans l'infobulle. */
  comparisonLabel: string;
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={[...data]} margin={{ top: 6, right: 4, bottom: 2, left: 4 }}>
          <Tooltip
            cursor={{ stroke: "var(--viz-axis)", strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0]?.payload as WebSparkPoint | undefined;
              if (!point) return null;
              return (
                <div className="bg-background border-border rounded-md border px-2.5 py-1.5 text-xs shadow-sm">
                  <p className="text-muted-foreground">{String(label)}</p>
                  <p className="text-foreground font-semibold tabular-nums">
                    {formatSparkValue(point.value, kind)}
                  </p>
                  <p className="text-muted-foreground tabular-nums">
                    {comparisonLabel} : {formatSparkValue(point.previous, kind)}
                  </p>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="previous"
            stroke="var(--viz-axis)"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: "var(--viz-axis)", strokeWidth: 0 }}
            isAnimationActive={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--series-1)"
            strokeWidth={2}
            strokeLinecap="round"
            dot={false}
            activeDot={{
              r: 4,
              fill: "var(--series-1)",
              stroke: "var(--viz-surface)",
              strokeWidth: 2,
            }}
            isAnimationActive={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
