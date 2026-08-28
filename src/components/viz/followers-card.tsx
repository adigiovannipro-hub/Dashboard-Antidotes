"use client";

import { Users } from "lucide-react";

import { TrendLine, TrendLineTable } from "@/components/viz/trend-line";
import { VizCard } from "@/components/viz/viz-card";
import { formatValue } from "@/lib/format";

/**
 * La courbe d'abonnés, et ce qu'elle montre quand elle n'a rien à montrer.
 *
 * Meta n'expose pas d'historique : chaque passage quotidien ajoute **un**
 * point, et la mémoire longue est notre table. Au premier jour, la courbe
 * n'a donc qu'un relevé — et une courbe à un point rend un graphe cassé :
 * deux graduations identiques, une seule étiquette d'axe, aucune ligne. On
 * affiche alors le chiffre et on dit quand la courbe démarrera, au lieu de
 * laisser croire à une panne.
 */
export function FollowersCard({
  network,
  data,
  height = 240,
}: {
  network: string;
  data: readonly { label: string; value: number }[];
  height?: number;
}) {
  const subtitle =
    "Un point par mois — le relevé de fin de mois, posé par le passage quotidien. Le mois en cours avance jusqu'au 31, les mois révolus ne bougent plus";

  if (data.length < 2) {
    const only = data[0];
    return (
      <div className="border-border bg-surface shadow-card flex h-full flex-col rounded-lg border p-5">
        <p className="type-overline text-text-secondary">Abonnés {network}</p>
        <div className="mt-4 flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <Users className="text-text-tertiary size-5" strokeWidth={1.75} aria-hidden />
          <p className="text-text-primary text-3xl leading-none font-bold">
            {only ? formatValue(only.value, "integer") : "—"}
          </p>
          <p className="type-caption text-text-secondary max-w-xs leading-relaxed">
            {only
              ? `Relevé de ${only.label}. La courbe démarre au deuxième relevé — un par mois, posé par la synchronisation.`
              : "Aucun relevé pour l'instant. La synchronisation en pose un à chaque passage."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <VizCard
      title={`Abonnés ${network}`}
      subtitle={subtitle}
      chart={<TrendLine data={[...data]} height={height} />}
      table={
        <TrendLineTable data={[...data]} categoryLabel="Mois" valueLabel="Abonnés" />
      }
    />
  );
}
