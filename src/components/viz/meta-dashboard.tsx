"use client";

import { BarList, BarListTable } from "@/components/viz/bar-list";
import { Donut, DonutTable } from "@/components/viz/donut";
import { MetricsTable } from "@/components/viz/metrics-table";
import { HeroFigure, StatTile } from "@/components/viz/stat-tile";
import { TrendLine, TrendLineTable } from "@/components/viz/trend-line";
import { VizCard } from "@/components/viz/viz-card";
import { formatMetric } from "@/lib/format";
import { computeDelta } from "@/lib/metrics/aggregate";
import { computeMetric, TOP_POSTS_COLUMNS } from "@/lib/metrics/definitions";
import {
  DEFAULT_CLICK_MODE,
  type MetricId,
  type RawMetrics,
} from "@/lib/metrics/types";
import type { DemoAdSet, DemoBreakdown } from "@/lib/demo/bondet";
import { foldTail } from "@/lib/viz/palette";

/**
 * Les neuf métriques secondaires. Le ROAS est absent : il occupe le chiffre
 * héros, et l'afficher deux fois affaiblirait les deux.
 */
const SECONDARY_KPIS: MetricId[] = [
  "spend",
  "earn",
  "purchases",
  "cpa",
  "impressions",
  "clicks",
  "cpm",
  "ctr",
  "landingPageViews",
];

export function MetaDashboard({
  adSets,
  total,
  previousTotal,
  age,
  gender,
  regions,
  followers,
  period,
}: {
  adSets: readonly DemoAdSet[];
  total: RawMetrics;
  previousTotal: RawMetrics;
  age: readonly DemoBreakdown[];
  gender: readonly DemoBreakdown[];
  regions: readonly DemoBreakdown[];
  followers: readonly { label: string; value: number }[];
  period: { label: string; comparison: string };
}) {
  const mode = DEFAULT_CLICK_MODE;

  const delta = (metric: MetricId) =>
    computeDelta(
      metric,
      computeMetric(metric, total, mode),
      computeMetric(metric, previousTotal, mode),
    );

  // Les régions dépassent trois parts : on replie la queue plutôt que de
  // générer une quatrième teinte. Ici en barres, donc une seule teinte suffit,
  // mais le repli garde la liste lisible.
  const foldedRegions = foldTail(
    regions.map((region) => ({ label: region.label, value: region.value })),
    8,
  ).map((region) => ({
    ...region,
    share: region.value / total.impressions,
    outOfScale: region.isOther,
  }));

  return (
    <div className="space-y-4">
      {/* Le ROAS répond seul à « est-ce que ça a marché » : un chiffre héros par
          vue, contre dix cartes de poids égal sur le rapport actuel. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <HeroFigure
          metric="roas"
          value={computeMetric("roas", total, mode)}
          delta={delta("roas")}
          sentence={`${formatMetric("earn", total.purchaseValue)} générés pour ${formatMetric("spend", total.spend)} investis, sur ${formatMetric("purchases", total.purchases)} achats.`}
          period={`${period.label} · comparé à ${period.comparison}`}
        />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SECONDARY_KPIS.map((metric) => (
            <StatTile
              key={metric}
              metric={metric}
              value={computeMetric(metric, total, mode)}
              delta={delta(metric)}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <VizCard
          title="Abonnés Instagram"
          subtitle="Meta n'expose que 30 jours d'historique — l'antériorité s'importe en CSV"
          chart={<TrendLine data={followers} />}
          table={
            <TrendLineTable
              data={followers}
              categoryLabel="Mois"
              valueLabel="Abonnés"
            />
          }
        />

        <VizCard
          title="Genre"
          subtitle="Répartition des impressions"
          chart={<Donut data={gender} />}
          table={<DonutTable data={gender} categoryLabel="Genre" />}
        />

        <VizCard
          title="Tranches d'âge"
          subtitle="Répartition des impressions"
          chart={<BarList data={age} ordinal />}
          table={<BarListTable data={age} categoryLabel="Tranche d'âge" />}
        />

        <VizCard
          title="Régions"
          subtitle="Répartition des impressions"
          chart={<BarList data={foldedRegions} />}
          table={<BarListTable data={foldedRegions} categoryLabel="Région" />}
        />
      </div>

      <section className="bg-card rounded-lg p-5">
        <h3 className="mb-4 text-sm font-semibold">Performance par ad set</h3>
        <MetricsTable
          rows={adSets}
          columns={TOP_POSTS_COLUMNS}
          total={total}
          mode={mode}
        />
      </section>
    </div>
  );
}
