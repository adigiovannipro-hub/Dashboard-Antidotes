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
import { detailTitle, HERO_METRIC, KPI_SETS } from "@/lib/reporting/kpi-sets";
import type { SocialReportingNetwork } from "@/lib/reporting/networks";
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
  network: Exclude<SocialReportingNetwork, "meta-ads">;
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
  const mesure = (metric: MetricId) =>
    aucunePublication ? null : computeMetric(metric, total, mode);

  // Pas de comparaison sans mesure : un delta contre rien ne veut rien dire.
  const delta = (metric: MetricId) => {
    if (aucunePublication) return undefined;
    return computeDelta(
      metric,
      computeMetric(metric, total, mode),
      computeMetric(metric, previousTotal, mode),
    );
  };

  const networkName = network === "instagram" ? "Instagram" : "Facebook";
  const hero = HERO_METRIC[network];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HeroFigure
          metric={hero}
          value={mesure(hero)}
          delta={delta(hero)}
          /* Sans publication lue, « 0 vues » contredirait les tuiles à « — »
             juste à côté : on ne dit pas un chiffre qu'on n'a pas mesuré. */
          sentence={`${
            aucunePublication
              ? "Aucune publication lue sur la période"
              : /* Facebook : Meta ne rend plus les impressions par publication —
                   annoncer « 0 vues » accuserait le contenu, on compte ce qui
                   est mesuré. */
                `${formatValue(posts.length, "integer")} publication${posts.length > 1 ? "s" : ""}, ${
                  network === "facebook"
                    ? `${formatMetric("interactions", total.likes + total.comments + total.saves + total.shares)} interactions`
                    : `${formatMetric("impressions", total.impressions)} vues`
                }`
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
            value={mesure(metric)}
            delta={delta(metric)}
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
          <PostsTable
            posts={posts}
            withSaves={network === "instagram"}
            withImpressions={network === "instagram"}
          />
        </PanelBody>
      </Panel>
    </div>
  );
}
