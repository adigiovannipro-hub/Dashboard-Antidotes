import { notFound } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import {
  DashboardNav,
  type NavItem,
  type NavSection,
} from "@/components/dashboard-nav";
import { getWorkspace, requireViewer } from "@/lib/auth";
import { listBoards } from "@/lib/planning/queries";
import { createClient } from "@/lib/supabase/server";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const viewer = await requireViewer();
  const workspace = await getWorkspace(slug);

  // Un espace inaccessible est indiscernable d'un espace inexistant : rien ne
  // doit laisser deviner qu'un autre client porte ce nom.
  if (!workspace) notFound();

  const supabase = await createClient();
  const [{ data: dashboards }, boards] = await Promise.all([
    supabase
      .from("dashboards")
      .select("slug, name")
      .eq("workspace_id", workspace.id)
      .order("position"),
    listBoards(workspace.id),
  ]);

  // Le planning passe avant le reporting : on prépare le mois en cours bien
  // plus souvent qu'on ne relit les chiffres du mois dernier. Ses tableaux
  // (année, FAQ) sont des sous-entrées : la page n'a plus d'onglets à elle.
  const planning: NavItem[] =
    boards.length > 0
      ? [
          {
            segment: "planning",
            href: `/espace/${workspace.slug}/planning`,
            name: "Planning Éditorial",
            children: boards.map((board) => ({
              slug: board.slug,
              href: `/espace/${workspace.slug}/planning/${board.slug}`,
              // « Planning Éditorial 2026 » sous « Planning Éditorial » se
              // réduit à l'année : le parent porte déjà le nom.
              name:
                board.kind === "editorial" && board.year
                  ? String(board.year)
                  : board.name,
            })),
          },
        ]
      : [];

  // La section Planning Éditorial a sa route dédiée : une ligne `dashboards`
  // qui la double — reliquat d'un ancien seed — ferait apparaître l'entrée
  // deux fois. On l'écarte ici ; la migration 0012 nettoie la base.
  const reporting: NavItem[] = (dashboards ?? [])
    .filter(
      (dashboard) =>
        dashboard.slug !== "planning" &&
        dashboard.name.trim().toLowerCase() !== "planning éditorial",
    )
    .map((dashboard) => ({
      segment: dashboard.slug,
      href: `/espace/${workspace.slug}/${dashboard.slug}`,
      name: dashboard.name,
    }));

  const sections: NavSection[] = [
    { label: workspace.name, items: [...planning, ...reporting] },
  ];

  return (
    <>
      <AppHeader viewer={viewer} currentWorkspaceSlug={workspace.slug} />

      <div className="flex flex-1 flex-col md:flex-row">
        <DashboardNav
          ariaLabel={`Sections de ${workspace.name}`}
          sections={sections}
        />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </>
  );
}
