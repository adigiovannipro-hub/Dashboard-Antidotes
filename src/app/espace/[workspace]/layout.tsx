import { notFound } from "next/navigation";

import { AppShell } from "@/components/ds/app-shell";
import { DashboardNav, type NavItem } from "@/components/dashboard-nav";
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
  // plus souvent qu'on ne relit les chiffres du mois dernier.
  const items: NavItem[] = [
    // Le Contexte n'existe que pour l'owner : le lien n'est pas rendu aux
    // autres profils — et la page rend de toute façon 404, RLS derrière.
    ...(workspace.role === "owner"
      ? [
          {
            segment: "contexte",
            href: `/espace/${workspace.slug}/contexte`,
            name: "Contexte",
          },
        ]
      : []),
    ...(boards.length > 0
      ? [
          {
            segment: "planning",
            href: `/espace/${workspace.slug}/planning`,
            name: "Planning Éditorial",
          },
        ]
      : []),
    ...(dashboards ?? [])
      // La section Planning Éditorial est native depuis la migration 0008 ; un
      // dashboard homonyme créé à la main dans la table `dashboards` ferait
      // deux onglets identiques côte à côte. On écarte ces doublons.
      .filter(
        (dashboard) =>
          !dashboard.name
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .toLowerCase()
            .includes("planning"),
      )
      .map((dashboard) => ({
        segment: dashboard.slug,
        href: `/espace/${workspace.slug}/${dashboard.slug}`,
        name: dashboard.name,
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
