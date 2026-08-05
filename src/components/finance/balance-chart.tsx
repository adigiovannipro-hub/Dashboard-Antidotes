"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMoney, formatMoneyCompact } from "@/lib/finance/money";
import type { BalanceSeriesByWindow } from "@/lib/finance/queries";
import { seriesDelta, type SeriesPoint } from "@/lib/finance/series";
import { CHART_WINDOWS, type ChartWindow } from "@/lib/finance/types";

/**
 * Évolution du solde EUR disponible, au choix sur 7, 30 ou 90 jours.
 *
 * Les trois fenêtres arrivent pré-calculées du serveur : le toggle est un
 * simple changement d'état, sans aller-retour. Mêmes conventions que les
 * courbes du reporting — filets pleins, pas d'animation, une seule série donc
 * pas de légende.
 */
export function BalanceChart({ series }: { series: BalanceSeriesByWindow }) {
  const [window, setWindow] = useState<ChartWindow>(30);
  const points = series[window];
  const delta = seriesDelta(points);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="group"
          aria-label="Fenêtre d'observation"
          className="bg-background inline-flex rounded-lg p-0.5"
        >
          {CHART_WINDOWS.map((candidate) => (
            <button
              key={candidate}
              type="button"
              aria-pressed={window === candidate}
              onClick={() => setWindow(candidate)}
              className={
                window === candidate
                  ? "bg-primary text-primary-foreground focus-visible:ring-ring rounded-md px-3 py-1 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none"
                  : "text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-md px-3 py-1 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none"
              }
            >
              {candidate} j
            </button>
          ))}
        </div>

        {delta !== null ? (
          <p className="text-muted-foreground text-xs tabular-nums">
            {delta >= 0 ? "+" : "−"}
            {formatMoney(Math.abs(delta), "EUR")} sur la période
          </p>
        ) : null}
      </div>

      {points.length < 2 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          Pas encore assez d&apos;historique sur cette fenêtre. La courbe se
          dessine au fil des passages de la synchronisation horaire.
        </p>
      ) : (
        <Chart points={points} window={window} />
      )}
    </div>
  );
}

function Chart({ points, window }: { points: SeriesPoint[]; window: ChartWindow }) {
  const data = points.map((point) => ({
    label: formatTick(point.time, window),
    value: point.total_cents,
  }));

  const values = data.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.15, 100);
  const last = points.at(-1);

  return (
    <div style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="var(--viz-grid)" strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--viz-muted)", fontSize: 11 }}
            stroke="var(--viz-axis)"
            tickLine={false}
            axisLine={{ stroke: "var(--viz-axis)" }}
            minTickGap={24}
          />
          <YAxis
            domain={[Math.floor(min - pad), Math.ceil(max + pad)]}
            tick={{ fill: "var(--viz-muted)", fontSize: 11 }}
            tickFormatter={(value: number) => formatMoneyCompact(value, "EUR")}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          <Tooltip
            cursor={{ stroke: "var(--viz-axis)", strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="bg-background border-border rounded-md border px-2.5 py-1.5 text-xs shadow-sm">
                  <p className="text-muted-foreground">{String(label)}</p>
                  <p className="text-foreground font-semibold tabular-nums">
                    {formatMoney(Number(payload[0]?.value ?? 0), "EUR")}
                  </p>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--brand)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={false}
            activeDot={{
              r: 5,
              fill: "var(--brand)",
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
            {formatMoney(last.total_cents, "EUR")}
          </span>
        </p>
      ) : null}
    </div>
  );
}

/* À 7 jours les points sont horaires — « mer. 14 h » ; au-delà, quotidiens —
   « 5 août ». */
const HOURLY_TICK = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  hour: "numeric",
});
const DAILY_TICK = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
});

function formatTick(iso: string, window: ChartWindow): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return window <= 7 ? HOURLY_TICK.format(date) : DAILY_TICK.format(date);
}
