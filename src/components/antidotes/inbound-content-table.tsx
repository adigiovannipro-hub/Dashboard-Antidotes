"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Film } from "lucide-react";

import { EmptyState } from "@/components/ds/empty-state";
import { Panel, PanelBody, PanelHeader } from "@/components/ds/surface";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/antidotes/dates";
import { formatEngagement } from "@/lib/antidotes/inbound/engagement";
import {
  applyContentFilters,
  CONTENT_PERIODS,
  CONTENT_SORT_LABELS,
  type ContentFilters,
  type ContentSort,
} from "@/lib/antidotes/inbound/filters";
import type { InboundContent } from "@/lib/antidotes/inbound/queries";
import { POST_PLATFORM_LABELS, type PostPlatform, type RadarAccount } from "@/lib/antidotes/types";
import { formatValue } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Le tableau des contenus relevés — ce qui a marché chez les autres.
 *
 * Un reel se lit par sa **transcription**, pas par sa légende : c'est le
 * script qu'on vient chercher. Une grandeur que le réseau ne rend pas
 * s'affiche `—` et n'est jamais comptée pour zéro. Le tableau défile dans
 * son cadre : c'est lui qui est large, pas la page.
 */

const COLUMNS: { key: ContentSort | null; label: string; align?: "right" }[] = [
  { key: null, label: "Réseau" },
  { key: null, label: "Auteur" },
  { key: null, label: "Contenu" },
  { key: "vues", label: "Vues", align: "right" },
  { key: "likes", label: "Likes", align: "right" },
  { key: "commentaires", label: "Comm.", align: "right" },
  { key: null, label: "Part.", align: "right" },
  { key: null, label: "Enreg.", align: "right" },
  { key: "score", label: "Score", align: "right" },
  { key: "date", label: "Date", align: "right" },
];

export function InboundContentTable({
  contents,
  filters,
  accounts,
  now,
}: {
  contents: InboundContent[];
  filters: ContentFilters;
  accounts: RadarAccount[];
  /** L'instant de référence de la fenêtre, posé par le serveur : lu au rendu,
      il changerait à chaque passage et ferait glisser la période sous les pieds. */
  now: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const rows = useMemo(
    () =>
      applyContentFilters(
        contents.map((entry) => ({ ...entry, ...entry.post, platform: entry.post.platform })),
        filters,
        now,
      ),
    [contents, filters, now],
  );

  /** Les réseaux proposés sont ceux qu'on veille : un filtre vide ne sert à rien. */
  const platforms = useMemo(() => {
    const set = new Set<PostPlatform>(accounts.map((account) => account.platform));
    for (const entry of contents) set.add(entry.post.platform);
    return [...set];
  }, [accounts, contents]);

  const withParam = (patch: Record<string, string | null>) => {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") query.delete(key);
      else query.set(key, value);
    }
    for (const key of ["post", "brouillon", "sujet", "mien"]) query.delete(key);
    const search = query.toString();
    return search ? `${pathname}?${search}` : pathname;
  };

  const open = (postId: string) => router.push(withParam({ post: postId }), { scroll: false });

  return (
    <Panel>
      <PanelHeader
        title="Ce qui marche"
        count={rows.length}
        action={
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Chip href={withParam({ reseau: null })} active={filters.platform === null}>
              Tous
            </Chip>
            {platforms.map((platform) => (
              <Chip key={platform} href={withParam({ reseau: platform })} active={filters.platform === platform}>
                {POST_PLATFORM_LABELS[platform]}
              </Chip>
            ))}
            <span aria-hidden className="mx-1 h-4 w-px bg-border-strong" />
            {CONTENT_PERIODS.map((period) => (
              <Chip
                key={period.label}
                href={withParam({ jours: period.value === null ? "tout" : String(period.value) })}
                active={filters.days === period.value}
              >
                {period.label}
              </Chip>
            ))}
          </div>
        }
      />

      <PanelBody className="border-b border-border">
        <div className="flex flex-wrap items-end gap-3">
          <Threshold label="≥ vues" name="vues" value={filters.minViews} withParam={withParam} />
          <Threshold label="≥ likes" name="likes" value={filters.minLikes} withParam={withParam} />
          <Threshold label="≥ commentaires" name="commentaires" value={filters.minComments} withParam={withParam} />
          <p className="type-caption ml-auto text-text-secondary">
            Trié par {CONTENT_SORT_LABELS[filters.sort].toLowerCase()}
          </p>
        </div>
      </PanelBody>

      {rows.length === 0 ? (
        <PanelBody>
          <EmptyState icon={Film} message="Aucun contenu ne passe ces filtres. Élargissez la période ou baissez un seuil." />
        </PanelBody>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] border-collapse">
            <thead>
              <tr className="border-b border-border-strong">
                {COLUMNS.map((column) => (
                  <th
                    key={column.label}
                    scope="col"
                    className={cn(
                      "type-overline px-3 py-2 text-text-secondary",
                      column.align === "right" ? "text-right" : "text-left",
                    )}
                  >
                    {column.key ? (
                      <Link
                        href={withParam({ tri: column.key })}
                        className={cn(
                          "focus-visible:ring-ring rounded-sm hover:text-text-primary focus-visible:ring-2 focus-visible:outline-none",
                          filters.sort === column.key && "text-text-primary",
                        )}
                      >
                        {column.label}
                      </Link>
                    ) : (
                      column.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const post = row.post;
                const text = post.transcript?.trim() || post.content;
                return (
                  <tr
                    key={post.id}
                    onClick={() => open(post.id)}
                    className="cursor-pointer border-b border-border transition-colors duration-(--motion-duration) ease-standard last:border-0 hover:bg-muted"
                  >
                    <td className="px-3 py-2.5">
                      <span className="type-caption inline-flex items-center gap-1.5 rounded-pill bg-surface-sunken px-2 py-0.5 text-text-secondary">
                        {POST_PLATFORM_LABELS[post.platform]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="type-label truncate text-text-primary">{row.account?.label ?? post.author_handle ?? "—"}</p>
                      {row.account?.handle ? (
                        <p className="type-caption truncate text-text-secondary">{row.account.handle}</p>
                      ) : null}
                    </td>
                    <td className="max-w-md px-3 py-2.5">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          open(post.id);
                        }}
                        className="focus-visible:ring-ring block w-full rounded-sm text-left focus-visible:ring-2 focus-visible:outline-none"
                      >
                        <span className="type-body line-clamp-2 text-text-primary">{text}</span>
                      </button>
                      {post.media_kind === "video" ? (
                        <span className="type-caption mt-1 inline-flex items-center gap-1 text-text-secondary">
                          <Film className="size-3.5" strokeWidth={1.75} aria-hidden />
                          {post.transcript ? "Script" : "Vidéo"}
                        </span>
                      ) : null}
                    </td>
                    <Metric value={post.metrics.views} />
                    <Metric value={post.metrics.likes} />
                    <Metric value={post.metrics.comments} />
                    <Metric value={post.metrics.shares} />
                    <Metric value={post.metrics.saves} />
                    <td className="px-3 py-2.5 text-right">
                      <span className="type-label whitespace-nowrap text-text-primary tabular-nums">
                        {formatEngagement(row.score)}
                      </span>
                    </td>
                    <td className="type-caption px-3 py-2.5 text-right whitespace-nowrap text-text-secondary tabular-nums">
                      {post.published_at ? formatDate(post.published_at) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function Metric({ value }: { value: number | undefined }) {
  return (
    <td className="px-3 py-2.5 text-right">
      <span className="type-body whitespace-nowrap text-text-primary tabular-nums">
        {value === undefined ? "—" : formatValue(value, "integer")}
      </span>
    </td>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "type-caption focus-visible:ring-ring rounded-pill px-2.5 py-1 font-medium transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
        active ? "bg-primary text-primary-foreground" : "bg-surface-sunken text-text-secondary hover:text-text-primary",
      )}
    >
      {children}
    </Link>
  );
}

/**
 * Un seuil s'applique en quittant le champ ou à Entrée — jamais à la frappe :
 * une navigation par caractère rechargerait le tableau six fois pour « 10000 ».
 */
function Threshold({
  label,
  name,
  value,
  withParam,
}: {
  label: string;
  name: string;
  value: number | null;
  withParam: (patch: Record<string, string | null>) => string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(value?.toString() ?? "");

  const apply = () => {
    const next = draft.trim();
    if (next === (value?.toString() ?? "")) return;
    router.push(withParam({ [name]: next || null }), { scroll: false });
  };

  return (
    <label className="type-caption flex items-center gap-2 text-text-secondary">
      {label}
      <Input
        inputMode="numeric"
        value={draft}
        onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ""))}
        onBlur={apply}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            apply();
          }
        }}
        className="h-8 w-24 tabular-nums"
        placeholder="—"
      />
    </label>
  );
}
