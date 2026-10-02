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
  network = "meta-ads",
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
  /**
   * La régie de l'onglet. TikTok Ads reprend la charpente de Meta — mêmes
   * tables, même tableau par groupe d'annonces —, mais pas sa question : pas
   * de pixel d'achat à espérer par défaut, le coût du clic en héros, pas de
   * région (TikTok ne la rend qu'en identifiants GeoNames).
   */
  network?: "meta-ads" | "tiktok-ads";
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

  /* L'entonnoir et les colonnes d'achat n'ont de sens que là où des achats
     se mesurent : toujours sur Meta, sur TikTok dès qu'un seul apparaît. Sur
     un compte de notoriété, trois marches à zéro se liraient comme un
     échec. */
  const isTiktok = network === "tiktok-ads";
  const tracksPurchases = !isTiktok || total.purchases > 0 || previousTotal.purchases > 0;
  const columns = tracksPurchases
    ? TOP_POSTS_COLUMNS
    : TOP_POSTS_COLUMNS.filter(
        (metric) => !["purchases", "earn", "cpa", "cpl", "saves"].includes(metric),
      );
  const unit = isTiktok ? "Groupe d'annonces" : "Ad set";

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
              {unit}&nbsp;: {focus.adSet}
              {focus.campaign ? ` · ${focus.campaign}` : ""}
            </span>
            <X className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HeroFigure
          metric={HERO_METRIC[network]}
          value={computeMetric(HERO_METRIC[network], total, mode)}
          delta={delta(HERO_METRIC[network])}
          sentence={
            isTiktok
              ? `${formatMetric("clicks", total.clicks)} clics pour ${formatMetric("spend", total.spend)} investis.`
              : `${formatMetric("earn", total.purchaseValue)} générés pour ${formatMetric("spend", total.spend)} investis.`
          }
          period={`${period.label} · comparé à ${period.comparison}`}
          /* Une seule case : le ROAS réduit fait entrer les deux tuiles
             vidéo sans rangée orpheline (1 + 11 = 12 = 3 × 4) ; sur TikTok,
             1 + 7 = deux rangées de quatre. */
        />

        {KPI_SETS[network].map((metric) => (
          <StatTile
            key={metric}
            metric={metric}
            value={computeMetric(metric, total, mode)}
            delta={delta(metric)}
          />
        ))}
      </div>

      {tracksPurchases ? (
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
      ) : null}

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
                ? `Répartition des impressions du compte entier — ${isTiktok ? "TikTok" : "Meta"} ne ventile pas par ${unit.toLowerCase()}.`
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
            <div className={isTiktok ? "grid gap-6 md:grid-cols-2" : "grid gap-6 md:grid-cols-3"}>
              <Breakdown title="Genre">
                <BarList data={gender} />
              </Breakdown>
              <Breakdown title="Tranches d'âge">
                <BarList data={age} ordinal />
              </Breakdown>
              {isTiktok ? null : (
                <Breakdown title="Régions">
                  <BarList data={foldedRegions} />
                </Breakdown>
              )}
            </div>
          </PanelBody>
        </Panel>

        <FollowersCard network={isTiktok ? "TikTok" : "Instagram"} data={followers} height={220} />
      </div>

      <Panel>
        <PanelHeader
          title={isTiktok ? "Performance par groupe d'annonces" : detailTitle("meta-ads")}
          count={adSets.length}
          description={
            drillable
              ? `Cliquer une ligne filtre la page sur ce ${isTiktok ? "groupe d'annonces" : "ad set"} ; un en-tête trie le tableau.`
              : "Cliquer un en-tête trie le tableau ; le total est recalculé sur les agrégats."
          }
        />
        <PanelBody>
          <MetricsTable
            rows={adSets}
            columns={columns}
            unitLabel={unit}
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
