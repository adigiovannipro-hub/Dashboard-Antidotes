"use client";

import type { ComponentProps } from "react";
import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";
import type { ForecastChartView } from "./forecast-chart-view";

/**
 * La courbe prévisionnelle des Échéances, chargée à part.
 *
 * Même raison que pour la courbe des flux de la Finance : recharts et d3 ne
 * doivent pas retarder l'interactivité des groupes de mensualités, qui sont
 * ce qu'on vient lire. Voir `finance/flows-chart.tsx` pour le détail.
 */
const Lazy = dynamic(
  () => import("./forecast-chart-view").then((module) => module.ForecastChartView),
  {
    ssr: false,
    loading: () => <Skeleton className="h-40 w-full rounded-md" />,
  },
);

export function ForecastChart(props: ComponentProps<typeof ForecastChartView>) {
  return <Lazy {...props} />;
}
