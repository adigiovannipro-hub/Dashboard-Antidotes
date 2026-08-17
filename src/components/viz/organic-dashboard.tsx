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
import { heatmapBackground, performanceRank } from "@/lib/viz/palette";

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
          sentence={`${formatValue(posts.length, "integer")} publication${posts.length > 1 ? "s" : ""}, ${formatMetric("reach", total.reach)} personnes touchées${
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

const KIND_LABELS: Record<SocialPost["media_kind"], string> = {
  image: "Post",
  carousel: "Carrousel",
  video: "Reel",
};

type PostColumn = {
  header: string;
  value: (post: SocialPost) => number;
};

/**
 * Le détail par publication — même langage que le tableau des ad sets, heatmap
 * divergente comprise : les meilleures valeurs de chaque colonne en vert, les
 * moins bonnes en rouge, toutes les mesures organiques étant « plus c'est
 * haut, mieux c'est ».
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

  const columns: PostColumn[] = [
    { header: "Vues", value: (post) => Number(post.impressions) },
    {
      header: "Vues vidéo",
      value: (post) => (post.media_kind === "video" ? Number(post.impressions) : 0),
    },
    { header: "J'aime", value: (post) => Number(post.likes) },
    { header: "Commentaires", value: (post) => Number(post.comments) },
    ...(withSaves
      ? [{ header: "Enregistrements", value: (post: SocialPost) => Number(post.saves) }]
      : []),
    { header: "Partages", value: (post) => Number(post.shares) },
  ];

  // Les échelles de heatmap par colonne, calculées une fois sur les lignes
  // affichées — comme le tableau des ad sets.
  const columnValues = columns.map((column) => posts.map(column.value));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max text-xs">
        <thead>
          <tr className="text-muted-foreground text-left">
            <th scope="col" className="px-2 pb-2 font-medium">
              Publication
            </th>
            <th scope="col" className="px-2 pb-2 font-medium">
              Type
            </th>
            <th scope="col" className="px-2 pb-2 font-medium">
              Date
            </th>
            {columns.map((column) => (
              <th
                key={column.header}
                scope="col"
                className="px-2 pb-2 text-right font-medium"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr key={post.id} className="border-t border-[var(--viz-grid)]">
              <th scope="row" className="px-2 py-2 text-left font-normal">
                <a
                  href={post.permalink ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="focus-visible:ring-brand flex max-w-[20rem] items-center gap-2.5 rounded focus-visible:ring-2 focus-visible:outline-none"
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
              <td className="px-2 py-2">
                <span className="bg-surface-sunken text-text-secondary rounded-pill px-2 py-0.5 font-medium whitespace-nowrap">
                  {KIND_LABELS[post.media_kind] ?? "Post"}
                </span>
              </td>
              <td className="text-muted-foreground px-2 py-2 whitespace-nowrap">
                {formatDayFr(post.published_at.slice(0, 10))}
              </td>
              {columns.map((column, index) => {
                const value = column.value(post);
                // Une vue vidéo sur un post fixe n'est pas une contre-performance :
                // la colonne ne se teinte que là où elle a un sens.
                const shaded =
                  column.header !== "Vues vidéo" || post.media_kind === "video";
                const rank = shaded
                  ? performanceRank(value, columnValues[index]!, false)
                  : 0;
                return (
                  <td
                    key={column.header}
                    className="px-2 py-2 text-right"
                    style={
                      shaded
                        ? { backgroundColor: heatmapBackground(rank) }
                        : undefined
                    }
                  >
                    {formatValue(value, "integer")}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-muted-foreground mt-3 text-xs">
        Fond vert&nbsp;: les meilleures valeurs de la colonne ; fond
        rouge&nbsp;: les moins bonnes.
      </p>
    </div>
  );
}
