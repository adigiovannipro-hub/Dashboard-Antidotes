"use client";

import dynamic from "next/dynamic";

import { Delta } from "@/components/viz/delta";
import { Skeleton } from "@/components/ui/skeleton";
import type { WebDelta, WebSparkPoint } from "@/lib/web/data";
import { formatSparkValue, type WebSparkKind } from "./web-spark-view";

/**
 * Carte de mesure du Site Web : le chiffre, sa variation vs l'an dernier, et
 * la double courbe quotidienne en dessous — la forme des cartes du rapport
 * Looker, dans la grammaire des tuiles de la maison (texte à gauche, chiffre
 * en gras, pastille de variation).
 *
 * La courbe est différée comme toutes celles du projet : le tableau de bord
 * ne télécharge pas recharts avant de pouvoir lire un chiffre.
 */
const Spark = dynamic(
  () => import("./web-spark-view").then((module) => module.WebSparkView),
  {
    ssr: false,
    loading: () => <Skeleton className="h-18 w-full rounded-md" />,
  },
);

export function WebKpiCard({
  label,
  value,
  kind,
  delta,
  points,
  comparisonLabel,
  note,
}: {
  label: string;
  value: number | null;
  kind: WebSparkKind;
  delta: WebDelta;
  points: readonly WebSparkPoint[];
  /** « juillet 2025 » — la ligne grise, nommée sous le chiffre et au survol. */
  comparisonLabel: string;
  /** Une réserve à dire sous la courbe — « chiffre approché », typiquement. */
  note?: string;
}) {
  return (
    <div className="border-border bg-surface shadow-card rounded-lg border p-5">
      <p className="type-overline text-text-secondary leading-tight" title={label}>
        {label}
      </p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
        <p className="text-text-primary text-2xl leading-none font-semibold">
          {formatSparkValue(value, kind)}
        </p>
        <Delta
          ratio={delta.ratio}
          sentiment={delta.sentiment}
          comparisonLabel={`vs ${comparisonLabel}`}
        />
      </div>

      <div className="mt-3">
        <Spark data={[...points]} kind={kind} comparisonLabel={comparisonLabel} />
      </div>

      {note ? (
        <p className="type-caption text-text-tertiary mt-2 leading-snug">{note}</p>
      ) : null}
    </div>
  );
}
