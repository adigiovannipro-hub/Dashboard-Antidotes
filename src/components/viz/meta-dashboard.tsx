"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { Panel, PanelBody, PanelHeader } from "@/components/ds/surface";
import { BarList } from "@/components/viz/bar-list";
import type { BarDatum } from "@/components/viz/bar-list";
import { FollowersCard } from "@/components/viz/followers-card";
import { Funnel } from "@/components/viz/funnel";
import { MetricsTable, type MetricsTableRow } from "@/components/viz/metrics-table";
import { HeroFigure, StatTile } from "@/components/viz/stat-tile";
import { formatMetric } from "@/lib/format";
import { computeDelta } from "@/lib/metrics/aggregate";
import { computeMetric, TOP_POSTS_COLUMNS } from "@/lib/metrics/definitions";
import {
  DEFAULT_CLICK_MODE,
  type MetricId,
  type RawMetrics,
} from "@/lib/metrics/types";
import { detailTitle, HERO_METRIC, KPI_SETS } from "@/lib/reporting/kpi-sets";
import { foldTail } from "@/lib/viz/palette";

export function MetaDashboard({
  adSets,
  total,
  previousTotal,
  age,
  gender,
  regions,
  followers,
  period,
  tableTotal,
  focus,
  drillable = false,
}: {
  adSets: readonly MetricsTableRow[];
  total: RawMetrics;
  previousTotal: RawMetrics;
  age: readonly BarDatum[];
  gender: readonly BarDatum[];
  regions: readonly BarDatum[];
  followers: readonly { label: string; value: number }[];
  period: { label: string; comparison: string };
  /** Total du compte entier pour le pied du tableau — égal à `total` hors drill-down. */
  tableTotal?: RawMetrics;
  /** L'ad set ciblé, résolu en clair pour la pastille de filtre. */
  focus?: { id: string; campaign: string | null; adSet: string } | null;
  /** Le partage public reste statique : le drill-down n'est offert qu'ici. */
  drillable?: boolean;
}) {
  const mode = DEFAULT_CLICK_MODE;
  const router = useRouter();
  const searchParams = useSearchParams();

  /* Le filtre vit dans l'URL, comme tous les filtres de la maison : il se
     partage par copie du lien et survit au retour arrière. */
  const setFocus = (id: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("adset", id);
    else params.delete("adset");
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const delta = (metric: MetricId) =>
    computeDelta(
      metric,
      computeMetric(metric, total, mode),
      computeMetric(metric, previousTotal, mode),
    );

  /* Six régions au plus, la queue repliée : la liste en portait dix, dont
     quatre sous 1 % — quatre rangs pour un cinquantième du volume, quand la
     colonne d'à côté manquait de place. */
  const foldedRegions = foldTail(
    regions.map((region) => ({ label: region.label, value: region.value })),
    6,
    "Autres régions",
  ).map((region) => ({
    ...region,
    share: region.value / total.impressions,
    outOfScale: region.isOther,
  }));

  return (
    /*
     * Quatre bandes, chacune répondant à une question :
     *
     *   1. les chiffres — le ROAS en tête, puis les tuiles ;
     *   2. la conversion — l'entonnoir, couché, sur toute la largeur ;
     *   3. l'audience — à qui l'on parle, et combien ils sont ;
     *   4. le détail par ad set.
     *
     * L'entonnoir tenait une colonne à droite des tuiles : il y était à
     * l'étroit et déformait la grille des mesures. Couché sur sa propre
     * bande, il se lit de gauche à droite comme le parcours qu'il décrit.
     */
    <div className="space-y-5">
      {focus ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFocus(null)}
            className="rounded-pill bg-primary text-primary-foreground focus-visible:ring-brand inline-flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none"
            title="Retirer le filtre"
          >
            <span className="max-w-[24rem] truncate">
              Ad set&nbsp;: {focus.adSet}
              {focus.campaign ? ` · ${focus.campaign}` : ""}
            </span>
            <X className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HeroFigure
          metric={HERO_METRIC["meta-ads"]}
          value={computeMetric("roas", total, mode)}
          delta={delta("roas")}
          sentence={`${formatMetric("earn", total.purchaseValue)} générés pour ${formatMetric("spend", total.spend)} investis.`}
          period={`${period.label} · comparé à ${period.comparison}`}
          className="sm:col-span-2"
        />

        {KPI_SETS["meta-ads"].map((metric) => (
          <StatTile
            key={metric}
            metric={metric}
            value={computeMetric(metric, total, mode)}
            delta={delta(metric)}
          />
        ))}
      </div>

      <Panel>
        <PanelHeader
          title="Conversion"
          description="Du panier à l'achat, et ce qui se perd entre les deux."
        />
        <PanelBody>
          <Funnel
            steps={[
              { label: "Ajouts au panier", value: total.addToCart },
              { label: "Paiements initiés", value: total.initiatedCheckout },
              { label: "Achats", value: total.purchases },
            ]}
          />
        </PanelBody>
      </Panel>

      {/* Persona à gauche, abonnés à droite : on lit d'abord à qui l'on parle,
          ensuite combien ils sont. `items-stretch` par défaut de la grille —
          les deux cartes font la même hauteur, sans quoi la ligne se lit
          comme deux blocs sans rapport. */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel>
          <PanelHeader
            title="Persona"
            description={
              focus
                ? "Répartition des impressions du compte entier — Meta ne ventile pas par ad set."
                : "Répartition des impressions — qui a vu les campagnes."
            }
          />
          <PanelBody>
            {/*
             * Trois listes de barres, plus de donut : le donut du genre ne
             * tenait pas dans un tiers de panneau — la roue se décentrait et
             * « Femmes » se réduisait à « Fe… ». Les barres portent le libellé
             * **et** la part sur la même ligne, à toute largeur.
             */}
            <div className="grid gap-6 md:grid-cols-3">
              <Breakdown title="Genre">
                <BarList data={gender} />
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

        <FollowersCard network="Instagram" data={followers} height={220} />
      </div>

      <Panel>
        <PanelHeader
          title={detailTitle("meta-ads")}
          count={adSets.length}
          description={
            drillable
              ? "Cliquer une ligne filtre la page sur cet ad set ; un en-tête trie le tableau."
              : "Cliquer un en-tête trie le tableau ; le total est recalculé sur les agrégats."
          }
        />
        <PanelBody>
          <MetricsTable
            rows={adSets}
            columns={TOP_POSTS_COLUMNS}
            total={tableTotal ?? total}
            mode={mode}
            selectedId={drillable ? (focus?.id ?? null) : undefined}
            onSelectRow={drillable ? setFocus : undefined}
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
 * trois `VizCard` dans un panneau feraient trois cartes dans une carte. Ici le
 * panneau est le contenant, chaque découpage n'a qu'un titre et sa figure.
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
