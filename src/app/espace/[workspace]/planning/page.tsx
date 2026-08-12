import { notFound, redirect } from "next/navigation";

import { getWorkspace } from "@/lib/auth";
import { listBoards } from "@/lib/planning/queries";
import { requirePageAccess } from "@/lib/workspaces/access";
import { PLANNING_PAGE_KEY } from "@/lib/workspaces/types";

/** La section s'ouvre sur son premier tableau : pas d'écran de choix. */
export default async function PlanningIndexPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const workspace = await getWorkspace(slug);
  if (!workspace) notFound();
  await requirePageAccess(workspace, PLANNING_PAGE_KEY);

  const boards = await listBoards(workspace.id);
  if (boards.length === 0) notFound();

  redirect(`/espace/${slug}/planning/${boards[0]!.slug}`);
}
