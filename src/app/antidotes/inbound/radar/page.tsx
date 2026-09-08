import Link from "next/link";
import type { Metadata } from "next";
import { ExternalLink, Lightbulb, PenLine, Radar, Rss, Users } from "lucide-react";

import { AddAccountDialog, RadarActions } from "@/components/antidotes/radar-tools";
import { RadarAccounts } from "@/components/antidotes/radar-accounts";
import { RadarTopics } from "@/components/antidotes/radar-topics";
import { EmptyState } from "@/components/ds/empty-state";
import { FilterPills } from "@/components/ds/filter-pills";
import { StatCard, StatGrid } from "@/components/ds/stat-card";
import { StatusPill } from "@/components/ds/status-pill";
import { Panel, PanelHeader, PanelRows, SectionHeader } from "@/components/ds/surface";
import { Button } from "@/components/ui/button";
import { requireAntidotesAccess } from "@/lib/antidotes/access";
import { formatDate } from "@/lib/antidotes/dates";
import { formatEngagement } from "@/lib/antidotes/inbound/engagement";
import { getRadarData, studioAvailability } from "@/lib/antidotes/inbound/queries";
import { POST_PLATFORM_LABELS, type PostPlatform } from "@/lib/antidotes/types";

export const metadata: Metadata = { title: "Radar · Antidotes" };

type Search = Promise<Record<string, string | string[] | undefined>>;

const PLATFORMS: PostPlatform[] = ["linkedin", "instagram", "youtube", "tiktok", "x"];
const DAYS = [7, 30, 90];

/**
 * Le radar : les comptes qu'on veille, ce qui a marché chez eux — classé par
 * engagement rapporté à leur audience — et les sujets que le modèle en tire.
 * Les filtres vivent dans l'URL : `?reseau=` et `?jours=`.
 */
export default async function RadarPage({ searchParams }: { searchParams: Search }) {
  const [context, query] = await Promise.all([requireAntidotesAccess(), searchParams]);
  const rawPlatform = typeof query.reseau === "string" ? query.reseau : "";
  const platform = (PLATFORMS as string[]).includes(rawPlatform) ? (rawPlatform as PostPlatform) : null;
  const rawDays = Number(typeof query.jours === "string" ? query.jours : "30");
  const days = DAYS.includes(rawDays) ? rawDays : 30;

  const [data, availability] = await Promise.all([
    getRadarData({ orgId: context.orgId, filters: { platform, days } }),
    studioAvailability(),
  ]);
  const active = data.accounts.filter((account) => account.is_active).length;
  const newTopics = data.topics.filter((topic) => topic.status === "new");
  const best = data.posts[0] ?? null;
  const href = (next: { reseau?: string | null; jours?: number }) => {
    const params = new URLSearchParams();
    const reseau = next.reseau === undefined ? platform : next.reseau;
    const jours = next.jours ?? days;
    if (reseau) params.set("reseau", reseau);
    if (jours !== 30) params.set("jours", String(jours));
    const suffix = params.toString();
    return `/antidotes/inbound/radar${suffix ? `?${suffix}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Radar"
        count={data.accounts.length}
        className="flex-wrap"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <RadarActions hasAccounts={active > 0} hasPosts={data.corpusSize > 0} anthropic={availability.anthropic} />
            <AddAccountDialog availability={data.availability} />
          </div>
        }
      />

      <StatGrid>
        <StatCard label="Comptes veillés" value={active} context={data.accounts.length > active ? `${data.accounts.length - active} en pause` : "tous actifs"} icon={Users} />
        <StatCard label="Posts relevés" value={data.corpusSize} context={`${data.posts.length} sur ${days} jours`} icon={Rss} />
        <StatCard label="Sujets proposés" value={newTopics.length} context={newTopics.length > 0 ? "à écrire" : "rien en attente"} valueTone={newTopics.length > 0 ? "accent" : undefined} icon={Lightbulb} />
        <StatCard label="Meilleur post" value={best ? formatEngagement(best.score) : "—"} context={best ? (best.account?.label ?? best.post.author_handle ?? "") : "aucun post sur la période"} icon={Radar} />
      </StatGrid>

      {newTopics.length > 0 || data.topics.length > 0 ? (
        <Panel>
          <PanelHeader title="Sujets proposés" count={data.topics.length} />
          <RadarTopics topics={data.topics} />
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader
          title="Ce qui marche"
          count={data.posts.length}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <FilterPills
                ariaLabel="Réseau"
                current={platform ?? ""}
                options={[{ value: "", label: "Tous", href: href({ reseau: null }) }, ...PLATFORMS.map((entry) => ({ value: entry, label: POST_PLATFORM_LABELS[entry], href: href({ reseau: entry }) }))]}
              />
              <FilterPills
                ariaLabel="Période"
                current={String(days)}
                options={DAYS.map((entry) => ({ value: String(entry), label: `${entry} j`, href: href({ jours: entry }) }))}
              />
            </div>
          }
        />
        {data.posts.length === 0 ? (
          <EmptyState
            icon={Radar}
            message={data.accounts.length === 0 ? "Aucun compte veillé. Ajoutez les comptes de votre niche, le relevé quotidien fera le reste." : "Rien sur cette période. Relevez maintenant, ou élargissez."}
            className="m-5"
          />
        ) : (
          <PanelRows>
            {data.posts.map(({ post, account, score }) => (
              <div key={post.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_200px] lg:items-start">
                <div className="min-w-0">
                  <div className="type-caption flex flex-wrap items-center gap-2 text-text-secondary">
                    <StatusPill tone="neutral" dot={false}>{POST_PLATFORM_LABELS[post.platform]}</StatusPill>
                    <span className="text-text-primary">{account?.label ?? post.author_handle ?? "—"}</span>
                    {post.published_at ? <span>{formatDate(post.published_at)}</span> : null}
                    {post.url ? (
                      <a href={post.url} target="_blank" rel="noreferrer" className="focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm text-accent-ink hover:underline focus-visible:ring-2 focus-visible:outline-none">
                        Ouvrir <ExternalLink className="size-3" strokeWidth={1.75} aria-hidden />
                      </a>
                    ) : null}
                  </div>
                  <p className="type-body mt-1 line-clamp-3 whitespace-pre-wrap text-text-primary">{post.content}</p>
                </div>
                <div className="flex flex-col gap-2 lg:items-end">
                  <span className="type-stat text-text-primary tabular-nums">{formatEngagement(score)}</span>
                  <span className="type-caption text-text-secondary tabular-nums">
                    {[
                      post.metrics.likes !== undefined ? `${post.metrics.likes.toLocaleString("fr-FR")} réactions` : null,
                      post.metrics.comments !== undefined ? `${post.metrics.comments.toLocaleString("fr-FR")} comm.` : null,
                      post.metrics.shares !== undefined ? `${post.metrics.shares.toLocaleString("fr-FR")} partages` : null,
                      post.metrics.views !== undefined ? `${post.metrics.views.toLocaleString("fr-FR")} vues` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "sans chiffres"}
                  </span>
                  <Button render={<Link href={`/antidotes/inbound/studio?source=${post.id}`} />} size="sm" variant="outline">
                    <PenLine aria-hidden />
                    Écrire à partir de ce post
                  </Button>
                </div>
              </div>
            ))}
          </PanelRows>
        )}
      </Panel>

      {data.accounts.length > 0 ? (
        <Panel>
          <PanelHeader title="Comptes veillés" count={data.accounts.length} description="Les abonnés servent de dénominateur au score ; sans eux, le score est absolu." />
          <RadarAccounts accounts={data.accounts} availability={data.availability} />
        </Panel>
      ) : null}
    </div>
  );
}
