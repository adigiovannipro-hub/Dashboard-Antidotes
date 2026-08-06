import { notFound, redirect } from "next/navigation";

import { getWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Un espace n'est qu'une porte : on entre directement dans son premier dashboard. */
export default async function WorkspaceIndexPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const workspace = await getWorkspace(slug);
  if (!workspace) notFound();

  const supabase = await createClient();
  const { data: dashboards } = await supabase
    .from("dashboards")
    .select("slug")
    .eq("workspace_id", workspace.id)
    .order("position")
    .limit(1);

  const first = dashboards?.[0];
  if (first) redirect(`/espace/${workspace.slug}/${first.slug}`);

  return (
    <div className="flex flex-1 items-center justify-center py-10">
      <div className="text-muted-foreground max-w-sm space-y-2 text-center text-sm">
        <p className="text-foreground font-medium">{workspace.name}</p>
        <p>Cet espace ne contient encore aucun dashboard.</p>
      </div>
    </div>
  );
}
