"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ImageOff } from "lucide-react";

import { formatDayFr, formatValue } from "@/lib/format";
import type { SocialPost } from "@/lib/supabase/database.types";
import { heatmapBackground, performanceRank } from "@/lib/viz/palette";
import { cn } from "@/lib/utils";

/**
 * Le détail par publication — même grammaire que le tableau des ad sets :
 * table dense, colonnes triables au clic, heatmap divergente par colonne
 * (les meilleures valeurs en vert, les moins bonnes en rouge) et **ligne de
 * total** en pied.
 *
 * Le total suit la règle des ratios du projet : les grandeurs additives se
 * somment, un taux se **recalcule sur les agrégats** — jamais la moyenne des
 * taux de chaque ligne, qui donnerait à un post confidentiel le même poids
 * qu'à un reel vu cent mille fois.
 */

const KIND_LABELS: Record<SocialPost["media_kind"], string> = {
  image: "Post",
  carousel: "Carrousel",
  video: "Reel",
};

type Column = {
  key: string;
  header: string;
  /** Un pourcentage se totalise en recalculant sur les agrégats. */
  kind: "integer" | "percent";
  value: (post: SocialPost) => number | null;
  /** Le total de la colonne, depuis toutes les lignes affichées. */
  total: (posts: readonly SocialPost[]) => number | null;
  /** Fausse quand teinter la cellule n'aurait pas de sens (vues d'une image). */
  shaded?: (post: SocialPost) => boolean;
};

const number = (value: number | null | undefined) => Number(value ?? 0);

const sumOf = (posts: readonly SocialPost[], pick: (post: SocialPost) => number) =>
  posts.reduce((total, post) => total + pick(post), 0);

const interactions = (post: SocialPost) =>
  number(post.likes) + number(post.comments) + number(post.saves) + number(post.shares);

/** Portée si elle existe, vues sinon : Meta ne rend pas la portée partout. */
const engagementBase = (post: SocialPost) =>
  number(post.reach) || number(post.impressions);

export function PostsTable({
  posts,
  withSaves,
  withImpressions = true,
}: {
  posts: readonly SocialPost[];
  /** Les enregistrements n'existent que sur Instagram. */
  withSaves: boolean;
  /** Meta ne rend plus les impressions des publications de Page (fin 2025). */
  withImpressions?: boolean;
}) {
  const columns = useMemo<Column[]>(() => {
    const base: Column[] = [];
    if (withImpressions) {
      base.push({
        key: "impressions",
        header: "Impressions",
        kind: "integer",
        value: (post) => number(post.impressions),
        total: (rows) => sumOf(rows, (post) => number(post.impressions)),
      });
    }
    base.push(
      {
        key: "videoViews",
        header: "Vues vidéo",
        kind: "integer",
        value: (post) => number(post.video_views),
        total: (rows) => sumOf(rows, (post) => number(post.video_views)),
        // Une image n'a pas de vue vidéo : la teinter en rouge accuserait à tort.
        shaded: (post) => post.media_kind === "video",
      },
      {
        key: "likes",
        header: "J'aime",
        kind: "integer",
        value: (post) => number(post.likes),
        total: (rows) => sumOf(rows, (post) => number(post.likes)),
      },
      {
        key: "comments",
        header: "Commentaires",
        kind: "integer",
        value: (post) => number(post.comments),
        total: (rows) => sumOf(rows, (post) => number(post.comments)),
      },
    );

    if (withSaves) {
      base.push({
        key: "saves",
        header: "Enregistrements",
        kind: "integer",
        value: (post) => number(post.saves),
        total: (rows) => sumOf(rows, (post) => number(post.saves)),
      });
    }

    base.push(
      {
        key: "shares",
        header: "Partages",
        kind: "integer",
        value: (post) => number(post.shares),
        total: (rows) => sumOf(rows, (post) => number(post.shares)),
      },
      {
        key: "engagement",
        header: "Engagement",
        kind: "percent",
        value: (post) => {
          const base = engagementBase(post);
          return base > 0 ? (interactions(post) / base) * 100 : null;
        },
        total: (rows) => {
          const base = sumOf(rows, engagementBase);
          return base > 0 ? (sumOf(rows, interactions) / base) * 100 : null;
        },
      },
    );

    return base;
  }, [withSaves, withImpressions]);

  const [sort, setSort] = useState<{ key: string; desc: boolean }>({
    // Sans colonne Impressions (Facebook), les « J'aime » classent le mieux.
    key: withImpressions ? "impressions" : "likes",
    desc: true,
  });

  const sorted = useMemo(() => {
    const column = columns.find((candidate) => candidate.key === sort.key);
    if (!column) return posts;
    const factor = sort.desc ? -1 : 1;
    return [...posts].sort((a, b) => {
      const left = column.value(a);
      const right = column.value(b);
      // Une valeur indéfinie tombe en bas, quel que soit le sens du tri.
      if (left === null && right === null) return 0;
      if (left === null) return 1;
      if (right === null) return -1;
      return (left - right) * factor;
    });
  }, [posts, columns, sort]);

  // Les échelles de heatmap se calculent sur les lignes affichées.
  const columnValues = useMemo(
    () =>
      Object.fromEntries(
        columns.map((column) => [
          column.key,
          sorted
            .map((post) => column.value(post))
            .filter((value): value is number => value !== null),
        ]),
      ) as Record<string, number[]>,
    [columns, sorted],
  );

  if (posts.length === 0) {
    return (
      <p className="text-text-secondary type-body">
        Aucune publication sur la période.
      </p>
    );
  }

  const render = (column: Column, value: number | null) =>
    column.kind === "percent"
      ? value === null
        ? "—"
        : `${formatValue(value, "decimal")} %`
      : formatValue(value ?? 0, "integer");

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-xs">
          <caption className="sr-only">
            Performance par publication, triée par{" "}
            {columns.find((column) => column.key === sort.key)?.header}
            {sort.desc ? ", décroissant" : ", croissant"}.
          </caption>
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
              {columns.map((column) => {
                const isSorted = sort.key === column.key;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    className="pb-2 font-medium"
                    // `aria-sort` appartient à l'en-tête, pas au bouton : le
                    // rôle `button` ne le porte pas.
                    aria-sort={
                      isSorted ? (sort.desc ? "descending" : "ascending") : "none"
                    }
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setSort((current) =>
                          current.key === column.key
                            ? { key: column.key, desc: !current.desc }
                            : { key: column.key, desc: true },
                        )
                      }
                      className={cn(
                        "hover:text-foreground focus-visible:ring-brand flex w-full items-center justify-end gap-0.5 rounded px-2 py-1 transition-colors focus-visible:ring-2 focus-visible:outline-none",
                        isSorted && "text-foreground",
                      )}
                    >
                      {column.header}
                      {isSorted ? (
                        sort.desc ? (
                          <ArrowDown className="size-3" aria-hidden />
                        ) : (
                          <ArrowUp className="size-3" aria-hidden />
                        )
                      ) : null}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {sorted.map((post) => (
              <tr key={post.id} className="border-t border-[var(--viz-grid)]">
                <th scope="row" className="px-2 py-2 text-left font-normal">
                  <a
                    href={post.permalink ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="focus-visible:ring-brand flex max-w-[20rem] items-center gap-2.5 rounded focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {post.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- CDN Meta
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
                {columns.map((column) => {
                  const value = column.value(post);
                  const shaded = (column.shaded?.(post) ?? true) && value !== null;
                  const rank = shaded
                    ? performanceRank(value!, columnValues[column.key] ?? [], false)
                    : 0;
                  return (
                    <td
                      key={column.key}
                      className="px-2 py-2 text-right"
                      style={
                        shaded ? { backgroundColor: heatmapBackground(rank) } : undefined
                      }
                    >
                      {render(column, value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr className="border-t-2 border-[var(--viz-axis)] font-semibold">
              <th scope="row" colSpan={3} className="px-2 pt-2 text-left">
                Total général
              </th>
              {columns.map((column) => (
                <td key={column.key} className="px-2 pt-2 text-right">
                  {render(column, column.total(sorted))}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

    </div>
  );
}
