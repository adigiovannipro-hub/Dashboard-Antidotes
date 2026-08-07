"use client";

import { useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMoney, formatMoneyCompact } from "@/lib/finance/money";
import type {
  BalanceSeriesByWindow,
  ExpenseBucketsByWindow,
} from "@/lib/finance/queries";
import { seriesDelta, type SeriesPoint } from "@/lib/finance/series";
import { CHART_WINDOWS, type ChartWindow } from "@/lib/finance/types";

/**
 * Évolution du solde EUR disponible et des dépenses, sur 7, 30 ou 90 jours.
 *
 * Deux lectures dans un seul graphe : la **ligne verte** dit où en est la
 * trésorerie, les **barres rouges** disent ce qui l'a fait bouger. Séparées,
 * elles obligeaient à faire l'aller-retour entre deux blocs pour relier un
 * décrochage à sa cause.
 *
 * Deux axes, et c'est nécessaire : un solde à quelques milliers d'euros et une
 * dépense à quelques dizaines n'ont pas d'échelle commune — sur un axe unique,
 * les barres seraient un trait au ras du zéro.
 *
 * Les trois fenêtres arrivent pré-calculées du serveur : le sélecteur est un
 * simple changement d'état, sans aller-retour.
 */
export function BalanceChart({
  series,
  expenses,
}: {
  series: BalanceSeriesByWindow;
  expenses: ExpenseBucketsByWindow;
}) {
  const [window, setWindow] = useState<ChartWindow>(30);
  const points = series[window];
  const delta = seriesDelta(points);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="group"
          aria-label="Fenêtre d'observation"
          className="bg-surface-sunken inline-flex rounded-lg p-0.5"
        >
          {CHART_WINDOWS.map((candidate) => (
            <button
              key={candidate}
              type="button"
              aria-pressed={window === candidate}
              onClick={() => setWindow(candidate)}
              className={
                window === candidate
                  ? "bg-primary text-primary-foreground focus-visible:ring-ring type-caption rounded-md px-3 py-1 font-medium focus-visible:ring-2 focus-visible:outline-none"
                  : "text-text-secondary hover:text-text-primary focus-visible:ring-ring type-caption rounded-md px-3 py-1 font-medium focus-visible:ring-2 focus-visible:outline-none"
              }
            >
              {candidate} j
            </button>
          ))}
        </div>

        {delta !== null ? (
          <p className="type-caption text-text-secondary tabular-nums">
            {delta >= 0 ? "+" : "−"}
            {formatMoney(Math.abs(delta), "EUR")} sur la période
          </p>
        ) : null}
      </div>

      <Legend />

      {points.length < 2 ? (
        <p className="type-body text-text-secondary py-10 text-center">
          Pas encore assez d&apos;historique sur cette fenêtre. La courbe se
          dessine au fil des passages de la synchronisation horaire.
        </p>
      ) : (
        <Chart points={points} buckets={expenses[window]} window={window} />
      )}
    </div>
  );
}

/* Deux séries : une légende devient obligatoire. Celle de Recharts se place
   mal et ne suit pas l'échelle typographique — deux pastilles suffisent. */
function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="type-caption text-text-secondary flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-0.5 w-4 rounded-pill"
          style={{ background: "var(--series-1)" }}
        />
        Solde disponible
      </span>
      <span className="type-caption text-text-secondary flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-2.5 w-2 rounded-sm"
          style={{ background: "var(--danger)" }}
        />
        Dépenses
      </span>
    </div>
  );
}

function Chart({
  points,
  buckets,
  window,
}: {
  points: SeriesPoint[];
  buckets: Record<string, number>;
  window: ChartWindow;
}) {
  const data = points.map((point) => ({
    label: formatTick(point.time, window),
    solde: point.total_cents,
    depense: buckets[point.time] ?? 0,
  }));

  const balances = data.map((point) => point.solde);
  const min = Math.min(...balances);
  const max = Math.max(...balances);
  const pad = Math.max((max - min) * 0.15, 100);

  /* L'axe des dépenses ouvre à zéro — une barre dont la base est ailleurs ment
     sur son propre rapport de longueur. Un plafond minimal évite qu'une seule
     petite barre n'occupe toute la hauteur un jour creux.

     Le facteur 2,4 est le point d'équilibre entre les deux lectures : à
     l'échelle naturelle, les barres montaient jusqu'au plafond et la courbe
     disparaissait derrière elles. La plus haute plafonne désormais aux deux
     cinquièmes du cadre — assez pour comparer les jours entre eux, ce qui est
     tout ce qu'on demande à une barre ici, et pas assez pour voler la vedette
     au solde, qui est le sujet. */
  const spentMax = Math.max(...data.map((point) => point.depense), 1_000) * 2.4;

  const last = points.at(-1);

  return (
    <div>
      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 16, right: 8, bottom: 4, left: 0 }}
          >
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
              minTickGap={24}
            />
            <YAxis
              yAxisId="solde"
              domain={[Math.floor(min - pad), Math.ceil(max + pad)]}
              tick={{ fill: "var(--viz-muted)", fontSize: 11 }}
              tickFormatter={(value: number) => formatMoneyCompact(value, "EUR")}
              tickLine={false}
              axisLine={false}
              width={60}
            />
            <YAxis
              yAxisId="depense"
              orientation="right"
              domain={[0, spentMax]}
              hide
            />
            <Tooltip
              cursor={{ fill: "var(--viz-grid)", fillOpacity: 0.5 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0]?.payload as
                  | { solde: number; depense: number }
                  | undefined;
                if (!point) return null;
                return (
                  <div className="bg-surface border-border rounded-md border px-2.5 py-1.5 shadow-card">
                    <p className="type-caption text-text-secondary">
                      {String(label)}
                    </p>
                    <p className="type-label text-text-primary tabular-nums">
                      {formatMoney(point.solde, "EUR")}
                    </p>
                    {point.depense > 0 ? (
                      <p className="type-caption text-danger-ink tabular-nums">
                        −{formatMoney(point.depense, "EUR")} dépensés
                      </p>
                    ) : null}
                  </div>
                );
              }}
            />
            {/* Les barres d'abord : posées après la ligne, elles la
                recouvriraient là où elles sont hautes. */}
            <Bar
              yAxisId="depense"
              dataKey="depense"
              name="Dépenses"
              fill="var(--danger)"
              fillOpacity={0.8}
              radius={[2, 2, 0, 0]}
              maxBarSize={10}
              isAnimationActive={false}
            />
            <Line
              yAxisId="solde"
              type="monotone"
              dataKey="solde"
              name="Solde disponible"
              stroke="var(--series-1)"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={{
                r: 5,
                fill: "var(--series-1)",
                stroke: "var(--viz-surface)",
                strokeWidth: 2,
              }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {last ? (
        <p className="type-caption text-text-secondary mt-1 text-right">
          Dernier point&nbsp;:{" "}
          <span className="type-label text-text-primary tabular-nums">
            {formatMoney(last.total_cents, "EUR")}
          </span>
        </p>
      ) : null}
    </div>
  );
}

/* À 7 jours les points sont horaires — « mer. 14 h » ; au-delà, quotidiens —
   « 5 août ». Fuseau explicite : sans lui, le libellé dépend de la machine qui
   rend la page, et un point du soir bascule au lendemain. */
const HOURLY_TICK = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  hour: "numeric",
  timeZone: "Europe/Paris",
});
const DAILY_TICK = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Paris",
});

function formatTick(iso: string, window: ChartWindow): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return window <= 7 ? HOURLY_TICK.format(date) : DAILY_TICK.format(date);
}
