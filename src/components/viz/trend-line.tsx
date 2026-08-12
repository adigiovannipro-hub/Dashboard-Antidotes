"use client";

import type { ComponentProps } from "react";
import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";
import { formatValue } from "@/lib/format";
import type { TrendLineView } from "./trend-line-view";

export interface TrendPoint {
  /** Libellé d'axe déjà formaté (« juin 2026 »). */
  label: string;
  value: number;
}

/**
 * Courbe d'évolution mono-série, chargée à part.
 *
 * La courbe et son tableau vivaient dans le même fichier, donc dans le même
 * paquet : ouvrir un tableau de bord téléchargeait recharts et d3 avant de
 * pouvoir lire la moindre carte de mesure. Le tableau — qui n'est que du HTML
 * — reste ici et part avec la page ; seule la courbe est différée.
 *
 * `ssr: false` ne retire rien : `ResponsiveContainer` mesure son conteneur et
 * ne rend rien côté serveur. Voir `finance/flows-chart.tsx`.
 */
const Lazy = dynamic(
  () => import("./trend-line-view").then((module) => module.TrendLineView),
  {
    ssr: false,
    // Hauteur par défaut de la courbe : la carte ne doit pas se replier puis
    // se redéployer quand le module arrive.
    loading: () => <Skeleton className="h-55 w-full rounded-md" />,
  },
);

export function TrendLine(props: ComponentProps<typeof TrendLineView>) {
  return <Lazy {...props} />;
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
