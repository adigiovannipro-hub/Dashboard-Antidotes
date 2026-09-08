import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, FileText, PenLine, Send } from "lucide-react";

import { StudioNewForm } from "@/components/antidotes/studio-new-form";
import { StatCard, StatGrid } from "@/components/ds/stat-card";
import { StatusPill, type StatusTone } from "@/components/ds/status-pill";
import { Panel, PanelHeader, PanelRows, SectionHeader } from "@/components/ds/surface";
import { requireAntidotesAccess } from "@/lib/antidotes/access";
import { relativeDays } from "@/lib/antidotes/dates";
import { getRadarPost, listGeneratedPosts, listMyPosts, studioAvailability } from "@/lib/antidotes/inbound/queries";
import { createClient } from "@/lib/supabase/server";
import { GENERATED_POST_STATUS_LABELS, type GeneratedPostStatus, type RadarTopic } from "@/lib/antidotes/types";

export const metadata: Metadata = { title: "Studio · Antidotes" };

type Search = Promise<Record<string, string | string[] | undefined>>;

const TONES: Record<GeneratedPostStatus, StatusTone> = {
  draft: "warning",
  approved: "info",
  published: "positive",
  rejected: "neutral",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Le studio : écrire un post depuis un sujet — le sien, ou celui que le
 * radar propose (`?sujet=`), ou un post de la veille (`?source=`) — puis la
 * liste de ce qui est en brouillon, approuvé, publié.
 */
export default async function StudioPage({ searchParams }: { searchParams: Search }) {
  const [context, query] = await Promise.all([requireAntidotesAccess(), searchParams]);
  const topicId = typeof query.sujet === "string" && UUID.test(query.sujet) ? query.sujet : null;
  const sourceId = typeof query.source === "string" && UUID.test(query.source) ? query.source : null;

  const supabase = await createClient();
  const [posts, library, availability, topicRow, source] = await Promise.all([
    listGeneratedPosts({ orgId: context.orgId }),
    listMyPosts({ orgId: context.orgId }),
    studioAvailability(),
    topicId
      ? supabase.from("antidotes_radar_topics").select("*").eq("org_id", context.orgId).eq("id", topicId).maybeSingle()
      : Promise.resolve({ data: null }),
    sourceId ? getRadarPost({ orgId: context.orgId, postId: sourceId }) : Promise.resolve(null),
  ]);
  const topic = (topicRow.data as unknown as RadarTopic | null) ?? null;
  const count = (status: GeneratedPostStatus) => posts.filter((post) => post.status === status).length;

  return (
    <div className="space-y-6">
      <SectionHeader title="Studio" count={posts.length} />

      <StatGrid>
        <StatCard label="Brouillons" value={count("draft")} context="à relire" tone={count("draft") > 0 ? "warning" : undefined} toneLabel={count("draft") > 0 ? "à valider" : undefined} icon={FileText} />
        <StatCard label="Approuvés" value={count("approved")} context={availability.publish ? availability.publish : "prêts à partir"} icon={CheckCircle2} />
        <StatCard label="Publiés" value={count("published")} context="sur LinkedIn" valueTone={count("published") > 0 ? "accent" : undefined} icon={Send} />
        <StatCard label="Exemples de ton" value={library.length} context={availability.embeddings ? "rapprochés par vecteurs" : "rapprochés par recoupement lexical"} icon={PenLine} />
      </StatGrid>

      <StudioNewForm
        topic={topic ? { id: topic.id, title: topic.title, angle: topic.angle } : null}
        source={source ? { id: source.id, author: source.author_handle, excerpt: source.content.slice(0, 140).replace(/\s+/g, " ") + (source.content.length > 140 ? "…" : "") } : null}
        libraryCount={library.length}
        anthropic={availability.anthropic}
      />

      {posts.length > 0 ? (
        <Panel>
          <PanelHeader title="Posts" count={posts.length} />
          <PanelRows>
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/antidotes/inbound/studio/${post.id}`}
                className="focus-visible:ring-ring grid gap-2 px-5 py-4 hover:bg-surface-sunken focus-visible:ring-2 focus-visible:outline-none md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
              >
                <div className="min-w-0">
                  <p className="type-label truncate text-text-primary">{post.content.split("\n")[0]}</p>
                  <p className="type-caption mt-0.5 truncate text-text-secondary">
                    {post.topic ?? "Sans sujet"} · {relativeDays(post.updated_at)}
                    {post.published_url ? " · publié" : ""}
                  </p>
                </div>
                <StatusPill tone={TONES[post.status]}>{GENERATED_POST_STATUS_LABELS[post.status]}</StatusPill>
              </Link>
            ))}
          </PanelRows>
        </Panel>
      ) : null}
    </div>
  );
}
