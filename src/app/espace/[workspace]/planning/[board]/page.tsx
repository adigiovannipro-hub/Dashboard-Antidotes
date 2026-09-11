import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { FaqBoardView } from "@/components/planning/faq-board";
import { FaqModerationBoard } from "@/components/planning/faq-moderation-board";
import { PlanningBoardView } from "@/components/planning/planning-board";
import { getWorkspace } from "@/lib/auth";
import { listFaqEntries as listModerationFaqEntries } from "@/lib/moderation/queries";
import { createClient } from "@/lib/supabase/server";
import {
  flattenSubjects,
  getBoard,
  getBoardContent,
  listActivity,
  listBoards,
  listFaqEntries,
} from "@/lib/planning/queries";
import { getInstagramProfile } from "@/lib/social/queries";
import { parsePlanningView, planningViewCookie } from "@/lib/ui-preferences";
import { requirePageAccess } from "@/lib/workspaces/access";
import { PLANNING_PAGE_KEY } from "@/lib/workspaces/types";

type Params = Promise<{ workspace: string; board: string }>;
type Search = Promise<Record<string, string | undefined>>;

async function load(params: Params) {
  const { workspace: workspaceSlug, board: boardSlug } = await params;
  const workspace = await getWorkspace(workspaceSlug);
  if (!workspace) return null;

  const board = await getBoard(workspace.id, boardSlug);
  return board ? { workspace, board } : null;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const loaded = await load(params);
  if (!loaded) return { title: "Introuvable" };
  return { title: `${loaded.board.name} · ${loaded.workspace.name}` };
}

export default async function PlanningBoardPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const loaded = await load(params);
  if (!loaded) notFound();

  const { workspace, board } = loaded;
  await requirePageAccess(workspace, PLANNING_PAGE_KEY);

  const boards = await listBoards(workspace.id);
  const scope = { workspace: workspace.slug, board: board.slug };

  if (board.kind === "faq") {
    /* La FAQ du client est celle de la Modération : le tableau vit ici, dans
       la section Planning — au même endroit que le board Monday d'origine —
       et s'enrichit tout seul à chaque correction validée dans l'inbox. La
       RLS (20260830) ouvre ces lectures aux membres de l'espace. */
    const supabase = await createClient();
    const { data: moderationClient } = await supabase
      .from("moderation_clients")
      .select("id")
      .eq("workspace_id", workspace.id)
      .maybeSingle();
    const clientId = (moderationClient as { id: string } | null)?.id ?? null;

    if (!clientId) {
      // Pas de client de modération rattaché : l'ancien tableau libre reste.
      return (
        <FaqBoardView
          scope={scope}
          boards={boards}
          board={board}
          entries={await listFaqEntries(board.id)}
          workspaceSlug={workspace.slug}
        />
      );
    }

    const query = await searchParams;
    const [entries, { data: categories }] = await Promise.all([
      listModerationFaqEntries(clientId),
      supabase
        .from("faq_categories")
        .select("id, name")
        .eq("client_id", clientId)
        .order("position"),
    ]);

    return (
      <FaqModerationBoard
        boards={boards}
        board={board}
        workspaceSlug={workspace.slug}
        clientId={clientId}
        entries={
          workspace.role === "owner"
            ? entries
            : entries.filter((entry) => entry.active)
        }
        categories={(categories ?? []) as { id: string; name: string }[]}
        isOwner={workspace.role === "owner"}
        openEntryId={query.entree ?? null}
      />
    );
  }

  const isOwner = workspace.role === "owner";

  /* L'inventaire, les affectations et les livrables ne se lisent plus ici :
     le branchement des comptes a rejoint le Reporting, là où un onglet vide
     fait chercher le geste. Le planning ne garde que la vitrine du compte
     Instagram, dont son aperçu de feed a besoin. */
  const [{ months, owners, columns, archived, trash }, query, instagramProfile] =
    await Promise.all([
      getBoardContent(board),
      searchParams,
      getInstagramProfile(workspace.id),
    ]);

  // La publication ouverte vient de l'URL : un lien partagé rouvre le même
  // panneau, et le retour arrière le referme. Une ligne archivée ou à la
  // corbeille s'ouvre aussi — son lien ne meurt pas avec son rangement.
  const openSubject = query.sujet
    ? ([...flattenSubjects(months), ...archived, ...trash.subjects].find(
        (subject) => subject.id === query.sujet,
      ) ?? null)
    : null;

  const drawer = openSubject
    ? { subject: openSubject, activity: await listActivity(openSubject.id) }
    : null;

  const now = new Date();
  const currentMonthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;

  // L'état de lecture du tableau — tri, mois ouverts, réseaux repliés — est
  // relu ici : c'est le serveur qui rend la première image, elle doit déjà
  // être la bonne, sans clignotement au montage.
  const cookieStore = await cookies();
  const view = parsePlanningView(
    cookieStore.get(planningViewCookie(workspace.slug, board.slug))?.value,
  );

  return (
    <PlanningBoardView
      scope={scope}
      boards={boards}
      board={board}
      months={months}
      columns={columns}
      owners={owners}
      drawer={drawer}
      archived={archived}
      trash={trash}
      currentMonthKey={currentMonthKey}
      workspaceSlug={workspace.slug}
      workspaceName={workspace.name}
      instagramProfile={instagramProfile}
      isOwner={isOwner}
      view={view}
    />
  );
}
