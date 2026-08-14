"use client";

import { Panel, PanelBody, PanelHeader } from "@/components/ds/surface";
import { BarList } from "@/components/viz/bar-list";
import { Donut } from "@/components/viz/donut";
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
    /*
     * Trois bandes, et pas une de plus.
     *
     *   1. les chiffres — le ROAS en tête, couché, puis les neuf tuiles ;
     *   2. l'audience — la courbe d'abonnés et les trois répartitions **sur la
     *      même ligne**, parce qu'elles répondent à une seule question :
     *      « à qui on parle ? » ;
     *   3. le détail par ad set.
     *
     * Avant, l'audience prenait deux rangées de deux cartes : quatre blocs de
     * poids égal pour trois découpages du même chiffre, et le tableau se
     * retrouvait sous la ligne de flottaison.
     */
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        <HeroFigure
          metric="roas"
          value={computeMetric("roas", total, mode)}
          delta={delta("roas")}
          sentence={`${formatMetric("earn", total.purchaseValue)} générés pour ${formatMetric("spend", total.spend)} investis, sur ${formatMetric("purchases", total.purchases)} achats.`}
          period={`${period.label} · comparé à ${period.comparison}`}
          className="col-span-2"
        />

        {SECONDARY_KPIS.map((metric) => (
          <StatTile
            key={metric}
            metric={metric}
            value={computeMetric(metric, total, mode)}
            delta={delta(metric)}
          />
        ))}
      </div>

      {/* `items-start` : sans lui, la carte la plus courte s'étire à la hauteur
          de sa voisine et la courbe d'abonnés flotte au-dessus d'un grand
          vide. */}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
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

        <Panel>
          <PanelHeader
            title="Persona"
            description="Répartition des impressions — qui a vu les campagnes."
          />
          <PanelBody>
            {/* Le genre est plus large que les deux autres : le donut mesure
                160 px et sa légende porte les libellés. À un tiers strict,
                « Femmes » se faisait rogner et il ne restait que la couleur —
                or l'identité ne repose jamais sur la seule couleur. */}
            <div className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <Breakdown title="Genre">
                <Donut data={gender} />
              </Breakdown>
              <Breakdown title="Tranches d'âge">
                <BarList data={age} ordinal />
              </Breakdown>
              <Breakdown title="Régions">
                <BarList data={foldedRegions} />
              </Breakdown>
            </div>
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="Performance par ad set"
          count={adSets.length}
          description="Trié par budget dépensé, du plus au moins investi."
        />
        <PanelBody>
          <MetricsTable
            rows={adSets}
            columns={TOP_POSTS_COLUMNS}
            total={total}
            mode={mode}
          />
        </PanelBody>
      </Panel>
    </div>
  );
}

/**
 * Une répartition dans le panneau Persona.
 *
 * `VizCard` porte sa propre bordure, son ombre **et sa bascule Tableau** :
 * trois `VizCard` dans un panneau feraient trois cartes dans une carte, et
 * trois tableaux dépliés en permanence tripleraient la hauteur de la bande
 * pour redire ce que les barres portent déjà en pourcentage. Ici le panneau
 * est le contenant, chaque découpage n'a qu'un titre et sa figure.
 */
function Breakdown({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="type-overline text-text-secondary mb-3">{title}</p>
      {children}
    </div>
  );
}
