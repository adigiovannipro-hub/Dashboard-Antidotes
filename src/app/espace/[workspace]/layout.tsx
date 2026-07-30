import { notFound } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { DashboardNav } from "@/components/dashboard-nav";
import { getWorkspace, requireViewer } from "@/lib/auth";
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
  const { data: dashboards } = await supabase
    .from("dashboards")
    .select("slug, name")
    .eq("workspace_id", workspace.id)
    .order("position");

  return (
    <>
      <AppHeader viewer={viewer} currentWorkspaceSlug={workspace.slug} />

      <div className="flex flex-1 flex-col md:flex-row">
        <DashboardNav
          workspaceSlug={workspace.slug}
          workspaceName={workspace.name}
          dashboards={dashboards ?? []}
        />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </>
  );
}
