"use client";

import { useState } from "react";

import { formatValue } from "@/lib/format";
import { seriesColor } from "@/lib/viz/palette";

export interface DonutDatum {
  label: string;
  value: number;
  share: number;
}

const SIZE = 160;
const STROKE = 18;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Le blanc de la surface fait la séparation — jamais un contour sur la part. */
const SURFACE_GAP = 2;

/**
 * Donut part-à-tout, **trois segments maximum**.
 *
 * C'est la seule forme du dashboard qui reste un donut : le genre se lit d'un
 * coup d'œil et ses trois parts passent le contrôle toutes-paires de la
 * palette. L'âge et les régions, eux, sont passés en barres — un donut ne se
 * lit pas au-delà de six segments ni sur des valeurs proches.
 */
export function Donut({ data }: { data: readonly DonutDatum[] }) {
  const [active, setActive] = useState<number | null>(null);

  if (data.length > 3) {
    throw new Error(
      `Donut appelé avec ${data.length} segments. Au-delà de trois, les teintes ` +
        "n'assurent plus la séparation daltonisme en toutes paires : replier la " +
        "queue dans « Autres » ou passer en barres.",
    );
  }

  // Les décalages cumulés sont dérivés, pas accumulés dans une variable
  // réassignée pendant le rendu : chaque segment démarre à la somme des parts
  // qui le précèdent.
  const segments = data.map((datum, index) => {
    const length = datum.share * CIRCUMFERENCE;
    const precedingShare = data
      .slice(0, index)
      .reduce((sum, previous) => sum + previous.share, 0);

    return {
      ...datum,
      index,
      color: seriesColor(index),
      // Le segment est raccourci de 2px : c'est le blanc de la surface qui
      // sépare les parts, jamais un contour.
      dash: Math.max(length - SURFACE_GAP, 0),
      offset: precedingShare * CIRCUMFERENCE,
    };
  });

  const shown = active !== null ? segments[active] : null;

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative shrink-0">
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={data
            .map(
              (datum) =>
                `${datum.label} ${formatValue(datum.share, "percent")}`,
            )
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
                opacity={active === null || active === segment.index ? 1 : 0.35}
                onMouseEnter={() => setActive(segment.index)}
                onMouseLeave={() => setActive(null)}
                className="transition-opacity"
              />
            ))}
          </g>
        </svg>

        {/* Le centre porte la part survolée, ou la plus grande par défaut. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-foreground text-xl leading-none font-semibold">
            {formatValue((shown ?? segments[0])?.share ?? 0, "percent")}
          </span>
          <span className="text-muted-foreground mt-1 max-w-[80%] truncate text-[11px]">
            {(shown ?? segments[0])?.label}
          </span>
        </div>
      </div>

      {/* Légende toujours présente dès deux séries : l'identité ne repose
          jamais sur la seule couleur. */}
      <ul className="min-w-0 flex-1 space-y-1.5">
        {segments.map((segment) => (
          <li
            key={segment.label}
            className="flex items-baseline gap-2 text-xs"
            onMouseEnter={() => setActive(segment.index)}
            onMouseLeave={() => setActive(null)}
          >
            <span
              aria-hidden
              className="mt-1 size-2 shrink-0 rounded-full"
              style={{ backgroundColor: segment.color }}
            />
            <span className="text-foreground min-w-0 flex-1 truncate">
              {segment.label}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {formatValue(segment.share, "percent")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DonutTable({
  data,
  categoryLabel,
}: {
  data: readonly DonutDatum[];
  categoryLabel: string;
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
              Part
            </th>
            <th scope="col" className="pb-2 text-right font-medium">
              Impressions
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((datum) => (
            <tr key={datum.label} className="border-t border-[var(--viz-grid)]">
              <th scope="row" className="py-1.5 text-left font-normal">
                {datum.label}
              </th>
              <td className="py-1.5 text-right">
                {formatValue(datum.share, "percent")}
              </td>
              <td className="py-1.5 text-right">
                {formatValue(datum.value, "integer")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
