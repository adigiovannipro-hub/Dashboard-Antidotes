"use client";

import { useState } from "react";

import type { BreakdownEntry } from "@/lib/finance/breakdown";
import { formatMoney } from "@/lib/finance/money";
import { foldTail, seriesColor } from "@/lib/viz/palette";
import { cn } from "@/lib/utils";

/**
 * La répartition des dépenses par catégorie — le camembert du panneau
 * Dépenses.
 *
 * Il suit le **même filtre de mois** que le tableau en dessous (les pastilles
 * de l'en-tête, `?mois=`) : changer de mois recalcule les parts côté serveur,
 * recatégoriser une ligne aussi — la répartition et le tableau lisent la même
 * résolution, ils ne peuvent pas se contredire.
 *
 * Trois parts colorées et pas une de plus, le reste replié dans « Autres » en
 * gris : la palette ne garantit la séparation daltonisme en toutes paires que
 * sur trois teintes (règle du design system, même cap que le donut du
 * Reporting). La **liste** à droite, elle, montre toutes les catégories avec
 * leur total — c'est elle qui répond à « combien pour cette catégorie ce
 * mois-ci », le camembert donne la silhouette.
 */

const SIZE = 168;
const STROKE = 20;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Le blanc de la surface sépare les parts — jamais un contour. */
const SURFACE_GAP = 2;

/** Au-delà, la queue part dans « Autres » — cap toutes-paires de la palette. */
const SLICE_CAP = 3;

const OTHER_LABEL = "Autres";

export function CategoryDonut({
  entries,
  totalCents,
  periodLabel,
}: {
  /** Toutes les catégories de la période, triées de la plus grosse à la plus petite. */
  entries: BreakdownEntry[];
  totalCents: number;
  /** « août 2026 », « toute la période »… — ce que le centre annonce. */
  periodLabel: string;
}) {
  const [active, setActive] = useState<string | null>(null);

  if (totalCents <= 0 || entries.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        Aucune dépense en euros sur cette période.
      </p>
    );
  }

  const folded = foldTail(
    entries.map((entry) => ({ label: entry.label, value: entry.cents })),
    SLICE_CAP,
    OTHER_LABEL,
  );

  // Décalages dérivés, jamais accumulés dans une variable réassignée.
  const segments = folded.map((slice, index) => {
    const share = slice.value / totalCents;
    const length = share * CIRCUMFERENCE;
    const preceding = folded
      .slice(0, index)
      .reduce((sum, previous) => sum + previous.value / totalCents, 0);

    return {
      label: slice.label,
      cents: slice.value,
      share,
      // « Autres » n'est pas une catégorie : gris neutre, hors palette de
      // séries — une teinte générée casserait la sûreté daltonisme.
      color: slice.isOther ? "var(--text-tertiary)" : seriesColor(index),
      dash: Math.max(length - SURFACE_GAP, 0),
      offset: preceding * CIRCUMFERENCE,
    };
  });

  const colorByLabel = new Map(segments.map((segment) => [segment.label, segment.color]));
  const foldedLabels = new Set(segments.map((segment) => segment.label));
  const shown = active !== null ? segments.find((s) => s.label === active) : null;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative shrink-0">
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={entries
            .map((entry) => `${entry.label} ${formatMoney(entry.cents, "EUR")}`)
            .join(", ")}
        >
          <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            {segments.map((segment) => (
              <circle
                key={segment.label}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={segment.color}
                strokeWidth={STROKE}
                strokeDasharray={`${segment.dash} ${CIRCUMFERENCE - segment.dash}`}
                strokeDashoffset={-segment.offset}
                opacity={active === null || active === segment.label ? 1 : 0.35}
                onMouseEnter={() => setActive(segment.label)}
                onMouseLeave={() => setActive(null)}
                className="transition-opacity"
              />
            ))}
          </g>
        </svg>

        {/* Le centre : la part survolée, sinon le total de la période. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
          <span className="text-foreground text-lg leading-tight font-semibold tabular-nums">
            {formatMoney(shown ? shown.cents : totalCents, "EUR")}
          </span>
          <span className="text-muted-foreground mt-0.5 max-w-full truncate text-[11px]">
            {shown ? shown.label : periodLabel}
          </span>
        </div>
      </div>

      {/* Toutes les catégories, chacune avec son total — la réponse chiffrée.
          Une catégorie repliée dans « Autres » porte un point creux gris :
          l'identité ne repose jamais sur la seule couleur, le libellé est là. */}
      <ul className="min-w-0 flex-1 basis-56 space-y-1.5">
        {entries.map((entry) => {
          const own = colorByLabel.get(entry.label);
          const inOther = !foldedLabels.has(entry.label);
          return (
            <li
              key={entry.label}
              className="flex items-baseline gap-2 text-xs"
              onMouseEnter={() => setActive(inOther ? OTHER_LABEL : entry.label)}
              onMouseLeave={() => setActive(null)}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-1 size-2 shrink-0 rounded-full",
                  inOther && "border border-[var(--text-tertiary)]",
                )}
                style={inOther ? undefined : { backgroundColor: own }}
              />
              <span className="text-foreground min-w-0 flex-1 truncate">
                {entry.label}
              </span>
              <span className="text-foreground font-medium tabular-nums">
                {formatMoney(entry.cents, "EUR")}
              </span>
              <span className="text-muted-foreground w-12 text-right tabular-nums">
                {(entry.share * 100).toLocaleString("fr-FR", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}
                %
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
