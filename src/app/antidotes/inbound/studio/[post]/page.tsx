import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { StudioEditor } from "@/components/antidotes/studio-editor";
import { StatusPill, type StatusTone } from "@/components/ds/status-pill";
import { Panel, PanelBody, PanelHeader, PanelRows, SectionHeader } from "@/components/ds/surface";
import { Button } from "@/components/ui/button";
import { requireAntidotesAccess } from "@/lib/antidotes/access";
import { formatDate } from "@/lib/antidotes/dates";
import { getStudioPost, studioAvailability } from "@/lib/antidotes/inbound/queries";
import { GENERATED_POST_STATUS_LABELS, POST_PLATFORM_LABELS, type GeneratedPostStatus } from "@/lib/antidotes/types";

type Params = Promise<{ post: string }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TONES: Record<GeneratedPostStatus, StatusTone> = {
  draft: "warning",
  approved: "info",
  published: "positive",
  rejected: "neutral",
};

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { post } = await params;
  return { title: `Post ${post.slice(0, 8)} · Studio` };
}

/** Un post généré : son texte à relire, les exemples qui l'ont façonné, sa matière, son visuel, ses issues. */
export default async function StudioPostPage({ params }: { params: Params }) {
  const { post: postId } = await params;
  if (!UUID.test(postId)) notFound();
  const context = await requireAntidotesAccess();
  const [detail, availability] = await Promise.all([getStudioPost({ orgId: context.orgId, postId }), studioAvailability()]);
  if (!detail) notFound();
  const { post } = detail;

  return (
    <div className="space-y-6">
      <div>
        <Button render={<Link href="/antidotes/inbound/studio" />} variant="ghost" size="sm">
          <ArrowLeft aria-hidden />
          Studio
        </Button>
      </div>

      <SectionHeader
        title={post.topic ?? "Post sans sujet"}
        description={detail.topic?.angle ?? post.brief ?? undefined}
        className="flex-wrap"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={TONES[post.status]}>{GENERATED_POST_STATUS_LABELS[post.status]}</StatusPill>
            {post.published_url ? (
              <Button render={<a href={post.published_url} target="_blank" rel="noreferrer" />} size="sm" variant="outline">
                <ExternalLink aria-hidden />
                Voir sur LinkedIn
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <StudioEditor post={post} visualUrl={detail.visualUrl} availability={availability} />

        <div className="space-y-5">
          <Panel>
            <PanelHeader
              title="Exemples de ton"
              count={detail.examples.length}
              description={detail.examples.length > 0 ? "Vos posts injectés dans le prompt, du plus proche au plus loin." : "Aucun exemple : la bibliothèque était vide."}
            />
            {detail.examples.length > 0 ? (
              <PanelRows>
                {detail.examples.map(({ post: example, similarity }) => (
                  <div key={example.id} className="px-5 py-3">
                    <div className="type-caption flex flex-wrap items-center gap-2 text-text-secondary">
                      <span className="tabular-nums">similarité {Math.round(similarity * 100)} %</span>
                      {example.published_at ? <span>{formatDate(example.published_at)}</span> : null}
                    </div>
                    <p className="type-caption mt-1 line-clamp-4 whitespace-pre-wrap text-text-primary">{example.content}</p>
                  </div>
                ))}
              </PanelRows>
            ) : null}
          </Panel>

          {detail.source ? (
            <Panel>
              <PanelHeader title="Matière" description="Le post de la veille qui a inspiré le sujet — jamais un modèle." />
              <PanelBody>
                <div className="type-caption flex flex-wrap items-center gap-2 text-text-secondary">
                  <StatusPill tone="neutral" dot={false}>{POST_PLATFORM_LABELS[detail.source.platform]}</StatusPill>
                  <span>{detail.source.author_handle ?? "—"}</span>
                  {detail.source.url ? (
                    <a href={detail.source.url} target="_blank" rel="noreferrer" className="focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm text-accent-ink hover:underline focus-visible:ring-2 focus-visible:outline-none">
                      Ouvrir <ExternalLink className="size-3" strokeWidth={1.75} aria-hidden />
                    </a>
                  ) : null}
                </div>
                <p className="type-caption mt-2 whitespace-pre-wrap text-text-primary">{detail.source.content}</p>
              </PanelBody>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
