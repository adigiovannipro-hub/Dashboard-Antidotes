"use client";

import { ImageOff } from "lucide-react";

import { Panel, PanelBody, PanelHeader } from "@/components/ds/surface";
import { HeroFigure, StatTile } from "@/components/viz/stat-tile";
import { TrendLine, TrendLineTable } from "@/components/viz/trend-line";
import { VizCard } from "@/components/viz/viz-card";
import { formatDayFr, formatMetric, formatValue } from "@/lib/format";
import { computeDelta } from "@/lib/metrics/aggregate";
import { computeMetric } from "@/lib/metrics/definitions";
import {
  DEFAULT_CLICK_MODE,
  type MetricId,
  type RawMetrics,
} from "@/lib/metrics/types";
import { detailTitle, HERO_METRIC, KPI_SETS } from "@/lib/reporting/kpi-sets";
import type { ReportingNetwork } from "@/lib/reporting/networks";
import type { SocialPost } from "@/lib/supabase/database.types";

/**
 * Le tableau de bord organique — Instagram et Facebook, même squelette que le
 * payant : les chiffres, l'audience, le détail. Sans entonnoir ni Persona,
 * qui sont des mesures publicitaires ; à leur place, la courbe d'abonnés tient
 * la bande d'audience seule, et le détail est **par publication**.
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
  network: Exclude<ReportingNetwork, "meta-ads">;
  posts: readonly SocialPost[];
  total: RawMetrics;
  previousTotal: RawMetrics;
  followers: readonly { label: string; value: number }[];
  followersNow: number | null;
  period: { label: string; comparison: string };
}) {
  const mode = DEFAULT_CLICK_MODE;
  const delta = (metric: MetricId) =>
    computeDelta(
      metric,
      computeMetric(metric, total, mode),
      computeMetric(metric, previousTotal, mode),
    );

  const networkName = network === "instagram" ? "Instagram" : "Facebook";
  const hero = HERO_METRIC[network];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        <HeroFigure
          metric={hero}
          value={computeMetric(hero, total, mode)}
          delta={delta(hero)}
          sentence={`${formatValue(posts.length, "integer")} publication${posts.length > 1 ? "s" : ""} parue${posts.length > 1 ? "s" : ""}, ${formatMetric("impressions", total.impressions)} vues${
            followersNow !== null
              ? ` — ${formatValue(followersNow, "integer")} abonnés aujourd'hui`
              : ""
          }.`}
          period={`${period.label} · comparé à ${period.comparison}`}
          className="col-span-2"
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

      <VizCard
        title={`Abonnés ${networkName}`}
        subtitle="Un point par mois, relevé par la synchronisation quotidienne — Meta n'expose pas d'historique au-delà de 30 jours"
        chart={<TrendLine data={[...followers]} height={280} />}
        table={
          <TrendLineTable
            data={[...followers]}
            categoryLabel="Mois"
            valueLabel="Abonnés"
          />
        }
      />

      <Panel>
        <PanelHeader
          title={detailTitle(network)}
          count={posts.length}
          description="Publications parues sur la période, de la plus récente à la plus ancienne."
        />
        <PanelBody>
          <PostsTable posts={posts} withSaves={network === "instagram"} />
        </PanelBody>
      </Panel>
    </div>
  );
}

/**
 * Le détail par publication, dans le même langage que le tableau des ad sets :
 * table dense `text-xs`, rangs séparés par le trait de grille.
 *
 * La vignette est décorative — la ligne se comprend par la légende et la
 * date — donc `alt` vide et un carré neutre quand elle manque.
 */
function PostsTable({
  posts,
  withSaves,
}: {
  posts: readonly SocialPost[];
  withSaves: boolean;
}) {
  if (posts.length === 0) {
    return (
      <p className="text-text-secondary type-body">
        Aucune publication sur la période.
      </p>
    );
  }

  const headers = [
    "Vues",
    "Portée",
    "J'aime",
    "Commentaires",
    ...(withSaves ? ["Enregistrements"] : []),
    "Partages",
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max text-xs">
        <thead>
          <tr className="text-muted-foreground text-left">
            <th scope="col" className="px-2 pb-2 font-medium">
              Publication
            </th>
            <th scope="col" className="px-2 pb-2 font-medium">
              Date
            </th>
            {headers.map((header) => (
              <th key={header} scope="col" className="px-2 pb-2 text-right font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => {
            const numbers = [
              post.impressions,
              post.reach,
              post.likes,
              post.comments,
              ...(withSaves ? [post.saves] : []),
              post.shares,
            ];
            return (
              <tr key={post.id} className="border-t border-[var(--viz-grid)]">
                <th scope="row" className="px-2 py-2 text-left font-normal">
                  <a
                    href={post.permalink ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="focus-visible:ring-brand flex max-w-[22rem] items-center gap-2.5 rounded focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {post.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.thumbnail_url}
                        alt=""
                        className="size-9 shrink-0 rounded-sm object-cover"
                      />
                    ) : (
                      <span className="bg-surface-sunken text-text-tertiary flex size-9 shrink-0 items-center justify-center rounded-sm">
                        <ImageOff className="size-4" strokeWidth={1.75} aria-hidden />
                      </span>
                    )}
                    <span className="truncate" title={post.caption ?? undefined}>
                      {post.caption?.trim() || "Sans légende"}
                    </span>
                  </a>
                </th>
                <td className="text-muted-foreground px-2 py-2 whitespace-nowrap">
                  {formatDayFr(post.published_at.slice(0, 10))}
                </td>
                {numbers.map((value, index) => (
                  <td key={headers[index]} className="px-2 py-2 text-right">
                    {formatValue(Number(value), "integer")}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
