"use client";

import type { ComponentProps } from "react";
import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";
import type { FlowsChartView } from "./flows-chart-view";

/**
 * La courbe des flux, chargée à part.
 *
 * Recharts embarque d3 : c'est la plus grosse dépendance du navigateur, et
 * elle était jusqu'ici dans le premier paquet de la page Finance — donc
 * téléchargée, analysée et exécutée **avant** que la bande de mesures et le
 * tableau des dépenses ne deviennent interactifs. Un graphique n'est pourtant
 * jamais la première chose qu'on lit sur cette page.
 *
 * `ssr: false` ne coûte rien de visible : `ResponsiveContainer` mesure son
 * conteneur, il ne rend donc **rien** côté serveur de toute façon. Ce qui était
 * rendu sur le serveur puis hydraté était un cadre vide. Ici, c'est un
 * squelette de la bonne hauteur, remplacé dès que le module arrive.
 *
 * Le nom public ne bouge pas : les pages importent toujours `FlowsChart`.
 */
const Lazy = dynamic(
  () => import("./flows-chart-view").then((module) => module.FlowsChartView),
  {
    ssr: false,
    loading: () => <Skeleton className="h-70 w-full rounded-md" />,
  },
);

export function FlowsChart(props: ComponentProps<typeof FlowsChartView>) {
  return <Lazy {...props} />;
}
