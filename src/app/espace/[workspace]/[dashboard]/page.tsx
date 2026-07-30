import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ workspace: string; dashboard: string }>;

async function load(params: Params) {
  const { workspace: workspaceSlug, dashboard: dashboardSlug } = await params;
  const workspace = await getWorkspace(workspaceSlug);
  if (!workspace) return null;

  const supabase = await createClient();
  const { data: dashboard } = await supabase
    .from("dashboards")
    .select("id, slug, name")
    .eq("workspace_id", workspace.id)
    .eq("slug", dashboardSlug)
    .maybeSingle();

  return dashboard ? { workspace, dashboard } : null;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const loaded = await load(params);
  if (!loaded) return { title: "Introuvable" };
  return { title: `${loaded.dashboard.name} · ${loaded.workspace.name}` };
}

export default async function DashboardPage({ params }: { params: Params }) {
  const loaded = await load(params);
  if (!loaded) notFound();

  const { workspace, dashboard } = loaded;

  return (
    <main className="space-y-6 p-6 md:p-8">
      <div className="space-y-1">
        <p className="text-muted-foreground text-sm">{workspace.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{dashboard.name}</h1>
      </div>

      <div className="border-border text-muted-foreground rounded-xl border border-dashed p-12 text-center text-sm">
        Les blocs de ce dashboard arrivent à l&apos;étape suivante.
      </div>
    </main>
  );
}
