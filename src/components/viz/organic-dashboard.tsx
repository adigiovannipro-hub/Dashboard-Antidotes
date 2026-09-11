"use client";

import { Panel, PanelBody, PanelHeader } from "@/components/ds/surface";
import { FollowersCard } from "@/components/viz/followers-card";
import { PostsTable } from "@/components/viz/posts-table";
import { HeroFigure, StatTile } from "@/components/viz/stat-tile";
import { formatMetric, formatValue } from "@/lib/format";
import { computeDelta } from "@/lib/metrics/aggregate";
import { computeMetric } from "@/lib/metrics/definitions";
import {
  DEFAULT_CLICK_MODE,
  type MetricId,
  type RawMetrics,
} from "@/lib/metrics/types";
import {
  detailTitle,
  HERO_METRIC,
  isUnmeasuredZero,
  KPI_SETS,
  metricLabelFor,
} from "@/lib/reporting/kpi-sets";
import { REPORTING_NETWORK_LABELS } from "@/lib/reporting/networks";
import type { SocialPost } from "@/lib/supabase/database.types";

/**
 * Le tableau de bord organique — Instagram et Facebook.
 *
 * Même charpente que le payant : les chiffres, l'audience, le détail. Sans
 * entonnoir ni Persona, qui sont des mesures publicitaires ; à leur place, la
 * courbe d'abonnés tient la bande d'audience, et le détail est **par
 * publication**.
 */
export function OrganicDashboard({
  network,
  posts,
  total,
  previousTotal,
  followers,
  followersNow,
  period,
}: {
  network: "instagram" | "facebook" | "linkedin" | "tiktok";
  posts: readonly SocialPost[];
  total: RawMetrics;
  previousTotal: RawMetrics;
  followers: readonly { label: string; value: number }[];
  followersNow: number | null;
  period: { label: string; comparison: string };
}) {
  const mode = DEFAULT_CLICK_MODE;

  /* Aucune publication lue ⇒ **rien n'a été mesuré**, et ce n'est pas la même
     chose que zéro. Sur Facebook le cas est structurel : Meta réserve la
     lecture des posts d'une Page à son App Review, et six tuiles à « 0 » se
     lisent comme une contre-performance du client au lieu d'une mesure
     absente. La règle de la maison vaut ici comme ailleurs — une source
     absente affiche « — », jamais une valeur inventée. */
  const aucunePublication = posts.length === 0;

  /* Sauf sur LinkedIn, où les chiffres des tuiles viennent de **la page**,
     pas de la somme des publications : ses impressions couvrent aussi les
     posts parus avant la période et encore vus pendant. Les lier à
     `posts.length` afficherait « — » sur des mesures bien réelles. */
  const parPublication = network !== "linkedin";
  const aucuneMesure = parPublication && aucunePublication;

  const mesure = (metric: MetricId) =>
    aucuneMesure ? null : computeMetric(metric, total, mode);

  // Pas de comparaison sans mesure : un delta contre rien ne veut rien dire.
  const delta = (metric: MetricId) => {
    if (aucuneMesure) return undefined;
    return computeDelta(
      metric,
      computeMetric(metric, total, mode),
      computeMetric(metric, previousTotal, mode),
    );
  };

  const networkName = REPORTING_NETWORK_LABELS[network];
  const hero = HERO_METRIC[network];

  /* Un seul gabarit pour les quatre onglets : combien de publications, et ce
     qui a été mesuré dessus. Chaque membre ne s'écrit que s'il porte un
     chiffre — les publications collectées avant la bascule de Meta vers
     `views` ont des impressions à zéro en base, et « 0 vues » accuserait un
     contenu qu'on n'a simplement pas mesuré. */
  const membres = aucuneMesure
    ? []
    : [
        `${formatValue(posts.length, "integer")} publication${posts.length > 1 ? "s" : ""}`,
        total.impressions > 0
          ? `${formatMetric("impressions", total.impressions)} vues`
          : null,
        // La portée vient de la page : elle ne vaut que là où la page mesure.
        !parPublication && total.reach > 0
          ? `${formatMetric("reach", total.reach)} personnes atteintes`
          : null,
      ].filter((membre): membre is string => membre !== null);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HeroFigure
          metric={hero}
          value={mesure(hero)}
          delta={delta(hero)}
          label={metricLabelFor(network, hero)}
          /* Sans publication lue, « 0 vues » contredirait les tuiles à « — »
             juste à côté : on ne dit pas un chiffre qu'on n'a pas mesuré. */
          sentence={`${
            membres.length > 0
              ? membres.join(", ")
              : "Aucune publication lue sur la période"
          }${
            followersNow !== null
              ? ` — ${formatValue(followersNow, "integer")} abonnés aujourd'hui`
              : ""
          }.`}
          period={`${period.label} · comparé à ${period.comparison}`}
          className="sm:col-span-2"
        />

        {KPI_SETS[network].map((metric) => (
          <StatTile
            key={metric}
            metric={metric}
            /* Un zéro que la source ne mesure pas s'écrit « — », sans
               variation : Meta n'a jamais rendu les enregistrements sur une
               Page. Les vues, elles, sont mesurées de nouveau — un zéro y
               est une vraie contre-performance. */
            value={isUnmeasuredZero(network, metric, mesure(metric)) ? null : mesure(metric)}
            delta={isUnmeasuredZero(network, metric, mesure(metric)) ? undefined : delta(metric)}
            label={metricLabelFor(network, metric)}
          />
        ))}
      </div>

      <FollowersCard network={networkName} data={followers} />

      <Panel>
        <PanelHeader
          title={detailTitle(network)}
          count={posts.length}
          description={
            aucunePublication && network === "facebook"
              ? "Meta réserve la lecture des publications d'une Page aux applications passées par son App Review — l'application n'a pas même le droit de demander la permission. Les abonnés, eux, se lisent sans elle."
              : "Publications parues sur la période. Cliquer un en-tête trie le tableau."
          }
        />
        <PanelBody>
          {/* Mêmes colonnes qu'Instagram : le client lit les deux tableaux
              avec la même grille. Sur Facebook, les enregistrements restent
              vides — une Page n'en a pas —, et une publication collectée
              avant la bascule vers `views` garde 0 vue, donc « — » de taux.
              LinkedIn n'a pas d'enregistrement du tout, mais il compte les
              clics — la seule colonne qui lui soit propre. */}
          <PostsTable
            posts={posts}
            withSaves={parPublication}
            withImpressions
            withClicks={!parPublication}
          />
        </PanelBody>
      </Panel>
    </div>
  );
}
