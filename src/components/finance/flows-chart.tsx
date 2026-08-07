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
import type { MonthlyFlow } from "@/lib/finance/queries";
import { FLOW_WINDOWS, type FlowWindow } from "@/lib/finance/types";

/**
 * Entrées et sorties du wallet, par totaux mensuels.
 *
 * Deux courbes de même unité — l'EUR du mois — donc **un seul axe** : les deux
 * grandeurs se comparent à l'œil, ce que l'ancien graphe à deux axes rendait
 * impossible. Le vert dit ce qui rentre, le rouge `--danger-ink` ce qui sort —
 * le même rouge que la pastille « à relancer », pas le rouge vif : une sortie
 * d'argent ordinaire n'est pas une alarme.
 *
 * Trois fenêtres : 3 et 6 mois dessinent la courbe ; « 1 mois » n'a qu'un
 * point, et une courbe à un point est un mensonge graphique — cette fenêtre
 * montre les chiffres du mois en cours, comparés au mois précédent.
 */
export function FlowsChart({ flows }: { flows: MonthlyFlow[] }) {
  const [window, setWindow] = useState<FlowWindow>(6);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="group"
          aria-label="Fenêtre d'observation"
          className="bg-surface-sunken inline-flex rounded-lg p-0.5"
        >
          {FLOW_WINDOWS.map((candidate) => (
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
              {candidate} mois
            </button>
          ))}
        </div>

        <Legend />
      </div>

      {window === 1 ? (
        <CurrentMonth flows={flows} />
      ) : (
        <Chart flows={flows.slice(-window)} />
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="type-caption text-text-secondary flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-0.5 w-4 rounded-pill"
          style={{ background: "var(--series-1)" }}
        />
        Entrées
      </span>
      <span className="type-caption text-text-secondary flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-0.5 w-4 rounded-pill"
          style={{ background: "var(--danger-ink)" }}
        />
        Sorties
      </span>
    </div>
  );
}

/* La fenêtre « 1 mois » : les totaux du mois en cours, avec le mois précédent
   en repère. Des chiffres, pas une courbe — un seul point ne se trace pas. */
function CurrentMonth({ flows }: { flows: MonthlyFlow[] }) {
  const current = flows.at(-1);
  const previous = flows.at(-2);
  if (!current) {
    return (
      <p className="type-body text-text-secondary py-10 text-center">
        Pas encore de mouvement synchronisé.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-3">
      <div>
        <p className="type-overline text-text-secondary">Entrées</p>
        <p className="type-stat text-text-primary tabular-nums">
          {formatMoney(current.in_cents, "EUR")}
        </p>
        {previous ? (
          <p className="type-caption text-text-secondary">
            {formatMoney(previous.in_cents, "EUR")} en {monthLabel(previous.month)}
          </p>
        ) : null}
      </div>
      <div>
        <p className="type-overline text-text-secondary">Sorties</p>
        <p className="type-stat text-danger-ink tabular-nums">
          −{formatMoney(current.out_cents, "EUR")}
        </p>
        {previous ? (
          <p className="type-caption text-text-secondary">
            −{formatMoney(previous.out_cents, "EUR")} en {monthLabel(previous.month)}
          </p>
        ) : null}
      </div>
      <div>
        <p className="type-overline text-text-secondary">Net</p>
        <p className="type-stat text-text-primary tabular-nums">
          {net(current) >= 0 ? "+" : "−"}
          {formatMoney(Math.abs(net(current)), "EUR")}
        </p>
        <p className="type-caption text-text-secondary">
          {monthLabel(current.month)} en cours
        </p>
      </div>
    </div>
  );
}

function net(flow: MonthlyFlow): number {
  return flow.in_cents - flow.out_cents;
}

function Chart({ flows }: { flows: MonthlyFlow[] }) {
  const data = flows.map((flow) => ({
    label: monthLabel(flow.month),
    entrees: flow.in_cents,
    sorties: flow.out_cents,
  }));

  const top = Math.max(
    ...data.map((point) => Math.max(point.entrees, point.sorties)),
    1_000,
  );

  return (
    <div style={{ height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 16, right: 8, bottom: 4, left: 0 }}
        >
          <defs>
            <linearGradient id="flux-entrees" x1="0" y1="0" x2="0" y2="1">
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
          />
          <YAxis
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
                | { entrees: number; sorties: number }
                | undefined;
              if (!point) return null;
              const balance = point.entrees - point.sorties;
              return (
                <div className="bg-surface border-border rounded-md border px-2.5 py-1.5 shadow-card">
                  <p className="type-caption text-text-secondary">{String(label)}</p>
                  <p className="type-label text-text-primary tabular-nums">
                    +{formatMoney(point.entrees, "EUR")}
                  </p>
                  <p className="type-caption text-danger-ink tabular-nums">
                    −{formatMoney(point.sorties, "EUR")}
                  </p>
                  <p className="type-caption text-text-secondary tabular-nums">
                    net {balance >= 0 ? "+" : "−"}
                    {formatMoney(Math.abs(balance), "EUR")}
                  </p>
                </div>
              );
            }}
          />
          {/* Les sorties d'abord : posées après, leur voile passerait
              par-dessus la ligne des entrées. */}
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
            dataKey="entrees"
            name="Entrées"
            stroke="var(--series-1)"
            strokeWidth={2.5}
            fill="url(#flux-entrees)"
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
  );
}

/* « mars 26 » — l'année car une fenêtre de six mois peut la traverser.
   Fuseau explicite : sans lui, le libellé dépend de la machine qui rend. */
const MONTH_TICK = new Intl.DateTimeFormat("fr-FR", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

function monthLabel(isoMonth: string): string {
  const date = new Date(`${isoMonth}-01T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return isoMonth;
  return MONTH_TICK.format(date);
}
