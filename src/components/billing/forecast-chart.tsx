"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMoney, formatMoneyCompact } from "@/lib/finance/money";
import type { ForecastPoint } from "@/lib/billing/schedule";

/**
 * Le prévisionnel des devis signés — même vocabulaire que la courbe verte du
 * dashboard Finance : aire `--accent`, trait `--series-1`, axes et grille
 * `viz-*`. Une seule série, donc pas de légende : le titre du panneau la
 * nomme.
 *
 * La courbe ne bouge qu'avec les devis — création, ajustement d'un mois,
 * clôture. Les factures libres d'Airwallex n'y entrent pas : on trace la
 * promesse signée, pas le réalisé. Douze mois arrivent pré-calculés du
 * serveur, le sélecteur 3 / 6 / 12 est un simple changement d'état.
 */

const SPANS = [
  { id: 3, label: "3 mois" },
  { id: 6, label: "6 mois" },
  { id: 12, label: "12 mois" },
] as const;

type SpanId = (typeof SPANS)[number]["id"];

export function ForecastChart({ points }: { points: ForecastPoint[] }) {
  const [span, setSpan] = useState<SpanId>(6);
  const visible = points.slice(0, span);
  const total = visible.reduce((sum, point) => sum + point.amount_cents, 0);

  return (
    <div className="space-y-3">
      <div
        role="group"
        aria-label="Horizon du prévisionnel"
        className="bg-surface-sunken inline-flex rounded-lg p-0.5"
      >
        {SPANS.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            aria-pressed={span === candidate.id}
            onClick={() => setSpan(candidate.id)}
            className={
              span === candidate.id
                ? "bg-primary text-primary-foreground focus-visible:ring-ring type-caption rounded-md px-3 py-1 font-medium focus-visible:ring-2 focus-visible:outline-none"
                : "text-text-secondary hover:text-text-primary focus-visible:ring-ring type-caption rounded-md px-3 py-1 font-medium focus-visible:ring-2 focus-visible:outline-none"
            }
          >
            {candidate.label}
          </button>
        ))}
      </div>

      <Chart points={visible} />

      <p className="type-caption text-text-secondary text-right">
        Sur {span} mois&nbsp;:{" "}
        <span className="type-label text-text-primary tabular-nums">
          {formatMoney(total, "EUR")}
        </span>{" "}
        HT prévus
      </p>
    </div>
  );
}

function Chart({ points }: { points: ForecastPoint[] }) {
  const data = points.map((point) => ({
    label: monthTick(point.month),
    montant: point.amount_cents,
    mensualites: point.count,
  }));

  const top = Math.max(...data.map((point) => point.montant), 1_000);

  return (
    /* Volontairement bas : la courbe donne la tendance d'un coup d'œil, les
       groupes en dessous restent la matière de l'écran. */
    <div style={{ height: 160 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="previsionnel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--viz-grid)" strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--viz-muted)", fontSize: 11 }}
            stroke="var(--viz-axis)"
            tickLine={false}
            axisLine={{ stroke: "var(--viz-axis)" }}
            minTickGap={16}
          />
          <YAxis
            /* Le plancher est zéro : une facturation ne descend pas sous
               terre, et une aire dont la base flotte ment sur les
               proportions. */
            domain={[0, Math.ceil(top * 1.15)]}
            tick={{ fill: "var(--viz-muted)", fontSize: 11 }}
            tickFormatter={(value: number) => formatMoneyCompact(value, "EUR")}
            tickLine={false}
            axisLine={false}
            width={60}
          />
          <Tooltip
            cursor={{ stroke: "var(--viz-axis)", strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0]?.payload as
                | { montant: number; mensualites: number }
                | undefined;
              if (!point) return null;
              return (
                <div className="bg-surface border-border rounded-md border px-2.5 py-1.5 shadow-card">
                  <p className="type-caption text-text-secondary">{String(label)}</p>
                  <p className="type-label text-text-primary tabular-nums">
                    {formatMoney(point.montant, "EUR")} HT
                  </p>
                  <p className="type-caption text-text-secondary">
                    {point.mensualites > 0
                      ? `${point.mensualites} mensualité${point.mensualites > 1 ? "s" : ""}`
                      : "aucune mensualité"}
                  </p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="montant"
            name="Facturation prévue"
            stroke="var(--series-1)"
            strokeWidth={2.5}
            fill="url(#previsionnel)"
            dot={{ r: 3, fill: "var(--series-1)", strokeWidth: 0 }}
            activeDot={{
              r: 5,
              fill: "var(--series-1)",
              stroke: "var(--viz-surface)",
              strokeWidth: 2,
            }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* « sept. 26 » — l'année, car une fenêtre de douze mois la traverse toujours.
   Fuseau explicite : sans lui, le libellé dépend de la machine qui rend. */
const MONTH_TICK = new Intl.DateTimeFormat("fr-FR", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

function monthTick(isoMonth: string): string {
  const date = new Date(`${isoMonth}-01T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? isoMonth : MONTH_TICK.format(date);
}
