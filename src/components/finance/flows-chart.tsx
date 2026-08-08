"use client";

import { useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMoney, formatMoneyCompact } from "@/lib/finance/money";
import type { PeriodFlow } from "@/lib/finance/queries";
import { FLOW_RANGES, type FlowRangeId } from "@/lib/finance/types";

/**
 * Le wallet période par période : la **courbe verte est le solde** — cumulée,
 * ancrée sur le disponible réel, son dernier point est le montant du wallet
 * aujourd'hui. La **courbe rouge est ce qui sort**, en `--danger-ink` — le
 * rouge de la pastille « à relancer », pas le rouge vif : une sortie d'argent
 * ordinaire n'est pas une alarme.
 *
 * Un seul axe : les deux séries sont en EUR. Quatre fenêtres — 7 jours, puis
 * 3, 6 ou 12 mois. Les deux grains arrivent pré-calculés du serveur, le
 * sélecteur est un simple changement d'état.
 */
export function FlowsChart({
  months,
  days,
}: {
  months: PeriodFlow[];
  days: PeriodFlow[];
}) {
  const [range, setRange] = useState<FlowRangeId>("6m");
  const current = FLOW_RANGES.find((candidate) => candidate.id === range)!;
  const flows =
    current.kind === "day" ? days.slice(-current.span) : months.slice(-current.span);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="group"
          aria-label="Fenêtre d'observation"
          className="bg-surface-sunken inline-flex rounded-lg p-0.5"
        >
          {FLOW_RANGES.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              aria-pressed={range === candidate.id}
              onClick={() => setRange(candidate.id)}
              className={
                range === candidate.id
                  ? "bg-primary text-primary-foreground focus-visible:ring-ring type-caption rounded-md px-3 py-1 font-medium focus-visible:ring-2 focus-visible:outline-none"
                  : "text-text-secondary hover:text-text-primary focus-visible:ring-ring type-caption rounded-md px-3 py-1 font-medium focus-visible:ring-2 focus-visible:outline-none"
              }
            >
              {candidate.label}
            </button>
          ))}
        </div>

        <Legend kind={current.kind} />
      </div>

      <Chart flows={flows} kind={current.kind} />
    </div>
  );
}

function Legend({ kind }: { kind: "day" | "month" }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="type-caption text-text-secondary flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-0.5 w-4 rounded-pill"
          style={{ background: "var(--series-1)" }}
        />
        Solde du wallet
      </span>
      <span className="type-caption text-text-secondary flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-0.5 w-4 rounded-pill"
          style={{ background: "var(--danger-ink)" }}
        />
        {kind === "day" ? "Sorties du jour" : "Sorties du mois"}
      </span>
    </div>
  );
}

function Chart({ flows, kind }: { flows: PeriodFlow[]; kind: "day" | "month" }) {
  const data = flows.map((flow) => ({
    label: periodLabel(flow.period, kind),
    solde: flow.balance_cents,
    entrees: flow.in_cents,
    sorties: flow.out_cents,
  }));

  const top = Math.max(
    ...data.map((point) => Math.max(point.solde, point.sorties)),
    1_000,
  );
  /* Le plancher reste à zéro tant que le solde n'est jamais négatif : une
     aire dont la base flotte ment sur les proportions. Un jour à découvert
     ferait descendre le cadre, pas disparaître la courbe. */
  const bottom = Math.min(...data.map((point) => point.solde), 0);

  const last = flows.at(-1);

  return (
    <div>
      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 16, right: 8, bottom: 4, left: 0 }}
          >
            <defs>
              <linearGradient id="flux-solde" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="flux-sorties" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--danger-ink)" stopOpacity={0.16} />
                <stop offset="100%" stopColor="var(--danger-ink)" stopOpacity={0.02} />
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
              domain={[Math.floor(bottom), Math.ceil(top * 1.15)]}
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
                  | { solde: number; entrees: number; sorties: number }
                  | undefined;
                if (!point) return null;
                return (
                  <div className="bg-surface border-border rounded-md border px-2.5 py-1.5 shadow-card">
                    <p className="type-caption text-text-secondary">{String(label)}</p>
                    <p className="type-label text-text-primary tabular-nums">
                      {formatMoney(point.solde, "EUR")}
                    </p>
                    <p className="type-caption text-text-secondary tabular-nums">
                      +{formatMoney(point.entrees, "EUR")} entrés
                    </p>
                    <p className="type-caption text-danger-ink tabular-nums">
                      −{formatMoney(point.sorties, "EUR")} sortis
                    </p>
                  </div>
                );
              }}
            />
            {/* Les sorties d'abord : posées après, leur voile passerait
                par-dessus la ligne du solde. */}
            <Area
              type="monotone"
              dataKey="sorties"
              name="Sorties"
              stroke="var(--danger-ink)"
              strokeWidth={1.75}
              fill="url(#flux-sorties)"
              dot={{ r: 3, fill: "var(--danger-ink)", strokeWidth: 0 }}
              activeDot={{
                r: 4,
                fill: "var(--danger-ink)",
                stroke: "var(--viz-surface)",
                strokeWidth: 2,
              }}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="solde"
              name="Solde du wallet"
              stroke="var(--series-1)"
              strokeWidth={2.5}
              fill="url(#flux-solde)"
              dot={{ r: 3, fill: "var(--series-1)", strokeWidth: 0 }}
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
          Aujourd&apos;hui&nbsp;:{" "}
          <span className="type-label text-text-primary tabular-nums">
            {formatMoney(last.balance_cents, "EUR")}
          </span>{" "}
          dans le wallet
        </p>
      ) : null}
    </div>
  );
}

/* « mars 26 » sur les mois — l'année, car une fenêtre de douze mois la
   traverse toujours ; « ven. 8 » sur les jours. Fuseau explicite : sans lui,
   le libellé dépend de la machine qui rend la page. */
const MONTH_TICK = new Intl.DateTimeFormat("fr-FR", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});
const DAY_TICK = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  timeZone: "UTC",
});

function periodLabel(period: string, kind: "day" | "month"): string {
  const iso = kind === "day" ? `${period}T00:00:00.000Z` : `${period}-01T00:00:00.000Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return period;
  return kind === "day" ? DAY_TICK.format(date) : MONTH_TICK.format(date);
}
