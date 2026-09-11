import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FaqTable } from "@/components/faq/faq-table";
import { FaqBoardView } from "@/components/planning/faq-board";
import { getWorkspace } from "@/lib/auth";
import {
  listFaqCategories,
  listFaqComments,
  listFaqEntries as listModerationFaqEntries,
} from "@/lib/moderation/queries";
import {
  getFaqBoard,
  listFaqEntries as listPlanningFaqEntries,
  listWorkspaceMembers,
} from "@/lib/planning/queries";
import { createClient } from "@/lib/supabase/server";
import { requirePageAccess } from "@/lib/workspaces/access";
import { FAQ_PAGE_KEY } from "@/lib/workspaces/types";

/**
 * La FAQ du client — le contrat de parole de la marque.
 *
 * C'était un onglet de la section Planning, sous forme de board
 * `kind = 'faq'` ; le retour d'écran du 11/09 en fait une page du menu de
 * l'espace, entre le Contexte et le Planning. Les données sont celles de la
 * Modération (`faq_entries`) : chaque correction validée dans l'inbox
 * enrichit ce tableau toute seule, et la RLS de 20260830 ouvre ces lectures
 * aux membres de l'espace, client compris.
 */

type Params = Promise<{ workspace: string }>;
type Search = Promise<Record<string, string | undefined>>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { workspace: slug } = await params;
  const workspace = await getWorkspace(slug);
  if (!workspace) return { title: "Introuvable" };
  return { title: `FAQ · ${workspace.name}` };
}

export default async function FaqPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { workspace: slug } = await params;
  const workspace = await getWorkspace(slug);
  if (!workspace) notFound();

  await requirePageAccess(workspace, FAQ_PAGE_KEY);

  const supabase = await createClient();
  const { data: moderationClient } = await supabase
    .from("moderation_clients")
    .select("id")
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  const clientId = (moderationClient as { id: string } | null)?.id ?? null;

  if (!clientId) {
    // Pas de client de modération rattaché : l'ancien tableau libre reste, sur
    // sa propre table — sans lui, un espace perdrait une FAQ déjà remplie.
    const board = await getFaqBoard(workspace.id);
    if (!board) notFound();
    return (
      <FaqBoardView
        scope={{ workspace: workspace.slug, board: board.slug }}
        board={board}
        entries={await listPlanningFaqEntries(board.id)}
      />
    );
  }

  const isOwner = workspace.role === "owner";
  const query = await searchParams;

  const [entries, categories, comments, members] = await Promise.all([
    listModerationFaqEntries(clientId),
    listFaqCategories(clientId),
    listFaqComments(clientId),
    listWorkspaceMembers(workspace.id),
  ]);

  return (
    <FaqTable
      clientId={clientId}
      entries={isOwner ? entries : entries.filter((entry) => entry.active)}
      categories={categories}
      comments={comments}
      members={members}
      isOwner={isOwner}
      openEntryId={query.entree ?? null}
    />
  );
}
