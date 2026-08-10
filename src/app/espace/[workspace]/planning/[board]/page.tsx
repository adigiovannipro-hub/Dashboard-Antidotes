import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FaqBoardView } from "@/components/planning/faq-board";
import { PlanningBoardView } from "@/components/planning/planning-board";
import { getWorkspace } from "@/lib/auth";
import {
  flattenSubjects,
  getBoard,
  getBoardContent,
  listActivity,
  listBoards,
  listFaqEntries,
} from "@/lib/planning/queries";

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
  const boards = await listBoards(workspace.id);
  const scope = { workspace: workspace.slug, board: board.slug };

  if (board.kind === "faq") {
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

  const [{ months, owners, columns }, query] = await Promise.all([
    getBoardContent(board),
    searchParams,
  ]);

  // La publication ouverte vient de l'URL : un lien partagé rouvre le même
  // panneau, et le retour arrière le referme.
  const openSubject = query.sujet
    ? (flattenSubjects(months).find((subject) => subject.id === query.sujet) ?? null)
    : null;

  const drawer = openSubject
    ? { subject: openSubject, activity: await listActivity(openSubject.id) }
    : null;

  const now = new Date();
  const currentMonthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;

  return (
    <PlanningBoardView
      scope={scope}
      boards={boards}
      board={board}
      months={months}
      columns={columns}
      owners={owners}
      drawer={drawer}
      currentMonthKey={currentMonthKey}
      workspaceSlug={workspace.slug}
    />
  );
}
