import { notFound } from "next/navigation";

import { AppShell } from "@/components/ds/app-shell";
import { DashboardNav, type NavItem } from "@/components/dashboard-nav";
import { getWorkspace, requireViewer } from "@/lib/auth";
import { listHiddenPages, listWorkspacePages } from "@/lib/workspaces/queries";

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

  // Les pages de l'espace et celles qu'un partenaire ne doit pas voir se
  // lisent au même endroit que la matrice de droits : deux listes qui
  // divergeraient laisseraient un onglet qui rend 404, ou l'inverse.
  const [pages, hidden] = await Promise.all([
    listWorkspacePages(workspace.id),
    workspace.role === "owner"
      ? Promise.resolve(new Set<string>())
      : listHiddenPages(workspace.id, viewer.email),
  ]);

  const items: NavItem[] = [
    // Le Contexte n'existe pas pour le client : le lien ne lui est pas rendu
    // — et la page rend de toute façon 404, RLS derrière. Le contributeur,
    // lui, écrit le brief : c'est son outil de travail.
    ...(workspace.role !== "client"
      ? [
          {
            segment: "contexte",
            href: `/espace/${workspace.slug}/contexte`,
            name: "Contexte",
          },
        ]
      : []),
    ...pages
      .filter((page) => !hidden.has(page.key))
      .map((page) => ({
        segment: page.key,
        href: `/espace/${workspace.slug}/${page.key}`,
        name: page.name,
      })),
  ];

  // Les sections de l'espace passent en onglets horizontaux : le rail latéral
  // porte déjà la navigation entre espaces, et deux rails verticaux côte à
  // côte se disputaient la lecture. `wide` : un planning est un tableau, il
  // prend l'écran qu'on lui donne.
  return (
    <AppShell viewer={viewer} title={workspace.name} wide>
      <div className="flex min-w-0 flex-col gap-6">
        <DashboardNav workspaceName={workspace.name} items={items} />
        <div className="min-w-0">{children}</div>
      </div>
    </AppShell>
  );
}
