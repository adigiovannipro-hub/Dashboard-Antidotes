import type { Metadata } from "next";
import { BookOpen, Hash, Sparkles, ThumbsUp } from "lucide-react";

import { LibraryAddDialog } from "@/components/antidotes/library-add-dialog";
import { LibraryRow } from "@/components/antidotes/library-row";
import { EmbedButton, LibraryImportForm } from "@/components/antidotes/library-tools";
import { EmptyState } from "@/components/ds/empty-state";
import { StatCard, StatGrid } from "@/components/ds/stat-card";
import { Panel, PanelHeader, PanelRows, SectionHeader } from "@/components/ds/surface";
import { requireAntidotesAccess } from "@/lib/antidotes/access";
import { listMyPosts, studioAvailability } from "@/lib/antidotes/inbound/queries";
import { formatDate } from "@/lib/antidotes/dates";

export const metadata: Metadata = { title: "Bibliothèque · Antidotes" };

/**
 * Mes meilleurs posts — le corpus de tonalité. Trente à cinquante posts, et
 * le studio a de quoi sonner comme moi ; sans eux, il écrit sobre et le dit.
 */
export default async function LibraryPage() {
  const context = await requireAntidotesAccess();
  const [posts, availability] = await Promise.all([listMyPosts({ orgId: context.orgId }), studioAvailability()]);
  const vectorised = posts.filter((post) => post.hasVector).length;
  const withMetrics = posts.filter((post) => post.metrics.likes !== undefined).length;
  const latest = posts.find((post) => post.published_at)?.published_at ?? null;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Bibliothèque"
        count={posts.length}
        className="flex-wrap"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <EmbedButton missing={posts.length - vectorised} available={availability.embeddings} />
            <LibraryImportForm />
            <LibraryAddDialog />
          </div>
        }
      />

      <StatGrid>
        <StatCard label="Mes posts" value={posts.length} context={posts.length >= 30 ? "de quoi démontrer le ton" : "objectif : trente à cinquante"} icon={BookOpen} />
        <StatCard
          label="Vectorisés"
          value={vectorised}
          context={availability.embeddings ? `${posts.length - vectorised} en attente` : "OPENAI_API_KEY absente : rapprochement lexical"}
          tone={!availability.embeddings && posts.length > 0 ? "warning" : undefined}
          toneLabel={!availability.embeddings && posts.length > 0 ? "sans vecteurs" : undefined}
          icon={Sparkles}
        />
        <StatCard label="Avec chiffres" value={withMetrics} context="réactions saisies" icon={ThumbsUp} />
        <StatCard label="Dernier post" value={latest ? formatDate(latest) : "—"} context={latest ? "date de publication" : "aucune date"} icon={Hash} />
      </StatGrid>

      {posts.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          message="Aucun post. Collez vos meilleurs posts un par un, ou importez le fichier Shares.csv de votre export LinkedIn."
        />
      ) : (
        <Panel>
          <PanelHeader title="Mes posts" count={posts.length} description="Réactions, commentaires et étiquettes s'enregistrent en quittant le champ." />
          <PanelRows>
            {posts.map((post) => (
              <LibraryRow key={post.id} post={post} />
            ))}
          </PanelRows>
        </Panel>
      )}
    </div>
  );
}
