"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { InboundCalendar } from "@/components/antidotes/inbound-calendar";
import { InboundContentTable } from "@/components/antidotes/inbound-content-table";
import { InboundMyPosts } from "@/components/antidotes/inbound-my-posts";
import { InboundSettingsForm } from "@/components/antidotes/inbound-settings-form";
import { InboundSheet } from "@/components/antidotes/inbound-sheet";
import { RadarAccounts } from "@/components/antidotes/radar-accounts";
import { RadarActions, AddAccountDialog } from "@/components/antidotes/radar-tools";
import { RadarTopics } from "@/components/antidotes/radar-topics";
import { EmptyState } from "@/components/ds/empty-state";
import {
  PillIndicator,
  useOptimisticPill,
  usePillIndicator,
} from "@/components/ds/pill-indicator";
import { LinkPending } from "@/components/ds/route-progress";
import { Panel, PanelBody, PanelHeader, SectionHeader } from "@/components/ds/surface";
import type { ContentFilters } from "@/lib/antidotes/inbound/filters";
import type { InboundData, InboundPostDetail, StudioPostDetail } from "@/lib/antidotes/inbound/queries";
import type { InboundView } from "@/lib/antidotes/inbound/views";
import { cn } from "@/lib/utils";
import { Lightbulb, Radio, Rss } from "lucide-react";

/**
 * L'écran de l'inbound : une barre de vues, la vue choisie, un panneau.
 *
 * Tout l'état d'affichage vit dans l'URL — la vue, les filtres, le mois du
 * calendrier, la ligne ouverte. Un écran se partage par copie du lien, et le
 * retour arrière ramène exactement ce qu'on regardait.
 */
export function InboundScreen({
  view,
  views,
  filters,
  month,
  data,
  postDetail,
  draftDetail,
  openTopicId,
}: {
  view: InboundView;
  views: readonly { key: InboundView; label: string }[];
  filters: ContentFilters;
  month: string;
  data: InboundData;
  postDetail: InboundPostDetail | null;
  draftDetail: StudioPostDetail | null;
  openTopicId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const { active, select } = useOptimisticPill(view);
  // Destructuré à l'appel : le lint des refs refuse qu'un objet qui porte une
  // ref soit lu pendant le rendu, même pour en tirer une largeur.
  const { listRef: pillsRef, box: pillsBox, measured: pillsMeasured } = usePillIndicator<HTMLUListElement>(active);

  const hrefFor = (next: InboundView) => {
    // Changer de vue garde les filtres qui la concernent et laisse tomber ce
    // qui n'a pas de sens ailleurs : une ligne ouverte, un mois de calendrier.
    const query = new URLSearchParams();
    if (next !== "contenus") query.set("vue", next);
    if (next === "contenus") {
      for (const key of ["reseau", "jours", "vues", "likes", "commentaires", "tri"]) {
        const value = params.get(key);
        if (value) query.set(key, value);
      }
    }
    const search = query.toString();
    return search ? `${pathname}?${search}` : pathname;
  };

  const closeSheet = () => {
    const query = new URLSearchParams(params.toString());
    for (const key of ["post", "brouillon", "sujet", "mien"]) query.delete(key);
    const search = query.toString();
    router.push(search ? `${pathname}?${search}` : pathname, { scroll: false });
  };

  const topic = useMemo(
    () => (openTopicId ? (data.topics.find((entry) => entry.id === openTopicId) ?? null) : null),
    [openTopicId, data.topics],
  );
  const myPost = useMemo(() => {
    const id = params.get("mien");
    return id ? (data.myPosts.find((post) => post.id === id) ?? null) : null;
  }, [params, data.myPosts]);

  const activeAccounts = data.accounts.filter((account) => account.is_active).length;
  const newTopics = data.topics.filter((entry) => entry.status === "new");

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Inbound"
        count={data.contents.length}
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <RadarActions
              hasAccounts={data.accounts.length > 0}
              hasPosts={data.contents.length > 0}
              anthropic={data.studio.anthropic}
            />
            <AddAccountDialog availability={data.availability} />
          </div>
        }
      />

      <nav aria-label="Vues de l'inbound" className="overflow-x-auto">
        <ul
          ref={pillsRef}
          className="relative inline-flex items-center gap-1 rounded-pill bg-surface-sunken p-1"
        >
          <PillIndicator box={pillsBox} />
          {views.map((entry) => {
            const current = active === entry.key;
            return (
              <li key={entry.key} data-pill={entry.key} className="relative">
                <Link
                  href={hrefFor(entry.key)}
                  aria-current={view === entry.key ? "page" : undefined}
                  onClick={() => select(entry.key)}
                  className={cn(
                    "type-caption focus-visible:ring-ring relative block rounded-pill px-3.5 py-1.5 font-medium whitespace-nowrap transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
                    current
                      ? cn("text-primary-foreground", !pillsMeasured && "bg-primary")
                      : "text-text-secondary hover:text-text-primary",
                  )}
                >
                  <LinkPending />
                  {entry.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {view === "contenus" ? (
        <InboundContentTable contents={data.contents} filters={filters} accounts={data.accounts} now={data.now} />
      ) : null}

      {view === "comptes" ? (
        <Panel>
          <PanelHeader
            title="Comptes veillés"
            count={data.accounts.length}
            description={`${activeAccounts} en veille`}
          />
          {data.accounts.length === 0 ? (
            <PanelBody>
              <EmptyState
                icon={Radio}
                message="Aucun compte veillé. Ajoutez un profil LinkedIn ou Instagram pour lancer la première vague."
              />
            </PanelBody>
          ) : (
            <RadarAccounts accounts={data.accounts} availability={data.availability} />
          )}
        </Panel>
      ) : null}

      {view === "sujets" ? (
        <Panel>
          <PanelHeader title="Sujets proposés" count={newTopics.length} />
          {data.topics.length === 0 ? (
            <PanelBody>
              <EmptyState
                icon={Lightbulb}
                message="Aucun sujet. « Proposer des sujets » lit les meilleurs contenus des trente derniers jours."
              />
            </PanelBody>
          ) : (
            <RadarTopics topics={data.topics} />
          )}
        </Panel>
      ) : null}

      {view === "mes-posts" ? (
        <InboundMyPosts posts={data.myPosts} drafts={data.drafts} embeddings={data.studio.embeddings} />
      ) : null}

      {view === "calendrier" ? <InboundCalendar month={month} drafts={data.drafts} now={data.now} /> : null}

      {view === "consignes" ? (
        <InboundSettingsForm settings={data.settings} accounts={data.accounts} />
      ) : null}

      {data.contents.length === 0 && view === "contenus" && data.accounts.length === 0 ? (
        <Panel>
          <PanelBody>
            <EmptyState
              icon={Rss}
              message="Rien de relevé pour l'instant : ajoutez un compte, le relevé passe chaque nuit."
            />
          </PanelBody>
        </Panel>
      ) : null}

      <InboundSheet
        postDetail={postDetail}
        draftDetail={draftDetail}
        topic={topic}
        myPost={myPost}
        studio={data.studio}
        onClose={closeSheet}
      />
    </div>
  );
}
