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

  /* Sauf sur LinkedIn, où les chiffres **ne viennent pas des publications** :
     l'API ne sert aucune liste de posts, seulement les compteurs de la page.
     Un tableau vide y est normal, et les tuiles restent pleines — les lier à
     `posts.length` afficherait « — » partout sur des mesures bien réelles. */
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
            aucuneMesure
              ? "Aucune publication lue sur la période"
              : !parPublication
                ? /* LinkedIn compte la page, pas les publications : on dit ce
                     qu'on mesure vraiment plutôt qu'un nombre de posts qu'on
                     n'a pas. */
                  `${formatMetric("impressions", total.impressions)} vues, ${formatMetric("reach", total.reach)} personnes atteintes`
                : /* Facebook : Meta ne rend plus les impressions par publication —
                   annoncer « 0 vues » accuserait le contenu, on compte ce qui
                   est mesuré. */
                  `${formatValue(posts.length, "integer")} publication${posts.length > 1 ? "s" : ""}, ${
                    network === "instagram"
                      ? `${formatMetric("impressions", total.impressions)} vues`
                      : `${formatMetric("interactions", total.likes + total.comments + total.saves + total.shares)} interactions`
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
            /* Un zéro que la source ne mesure pas s'écrit « — », sans
               variation : Meta ne rend ni impressions ni enregistrements
               sur une Page. */
            value={isUnmeasuredZero(network, metric, mesure(metric)) ? null : mesure(metric)}
            delta={isUnmeasuredZero(network, metric, mesure(metric)) ? undefined : delta(metric)}
          />
        ))}
      </div>

      <FollowersCard network={networkName} data={followers} />

      {/* LinkedIn n'a pas de tableau : l'API ne rend pas les publications
          d'une page. Un panneau vide avec un en-tête de colonnes se lirait
          comme une panne — on n'affiche rien plutôt que de promettre une
          liste qui n'arrivera pas. */}
      {parPublication ? (
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
                avec la même grille. Sur Facebook, impressions et
                enregistrements restent à zéro tant que Meta ne les rend pas. */}
            <PostsTable posts={posts} withSaves withImpressions />
          </PanelBody>
        </Panel>
      ) : null}
    </div>
  );
}
