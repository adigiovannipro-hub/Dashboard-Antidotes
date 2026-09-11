import { notFound, redirect } from "next/navigation";

import { getViewer, getWorkspace } from "@/lib/auth";
import { listHiddenPages, listWorkspacePages } from "@/lib/workspaces/queries";
import { PLANNING_PAGE_KEY } from "@/lib/workspaces/types";

/** Un espace n'est qu'une porte : on entre directement dans sa première page. */
export default async function WorkspaceIndexPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const viewer = await getViewer();
  const workspace = await getWorkspace(slug);
  if (!workspace) notFound();

  // La même liste que le menu de l'espace, droits compris : la porte
  // envoyait jusqu'ici sur le premier tableau de bord, y compris quand il
  // était masqué au visiteur — qui arrivait alors sur un 404 d'entrée.
  const [pages, hidden] = await Promise.all([
    listWorkspacePages(workspace.id),
    workspace.role === "owner"
      ? Promise.resolve(new Set<string>())
      : listHiddenPages(workspace.id, viewer?.email ?? ""),
  ]);

  const visible = pages.filter((page) => !hidden.has(page.key));
  // Le planning d'abord, quel que soit l'ordre du menu : la FAQ l'y précède
  // parce qu'on y cherche une formule, mais ce qu'on ouvre en entrant chez un
  // client, c'est le mois en cours.
  const first =
    visible.find((page) => page.key === PLANNING_PAGE_KEY) ?? visible[0];
  if (first) redirect(`/espace/${workspace.slug}/${first.key}`);

  return (
    <div className="flex flex-1 items-center justify-center py-10">
      <div className="text-muted-foreground max-w-sm space-y-2 text-center text-sm">
        <p className="text-foreground font-medium">{workspace.name}</p>
        <p>Aucune page ne t&apos;est ouverte dans cet espace.</p>
      </div>
    </div>
  );
}
