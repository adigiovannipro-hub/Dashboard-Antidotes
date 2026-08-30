import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FaqClientView } from "@/components/moderation/faq-client-view";
import { getWorkspace, requireViewer } from "@/lib/auth";
import type { FaqEntry } from "@/lib/moderation/types";
import { createClient } from "@/lib/supabase/server";
import { requirePageAccess } from "@/lib/workspaces/access";
import { FAQ_MODERATION_PAGE_KEY } from "@/lib/workspaces/types";

/**
 * Les éléments de langage, côté client.
 *
 * La seule fenêtre de l'espace sur la Modération : le client lit la FAQ qui
 * répond en son nom, et valide ou refuse chaque élément soumis. L'inbox, les
 * brouillons et les statistiques restent un outil interne — la RLS ne lui
 * ouvre que ces deux tables, en lecture.
 */

type Params = Promise<{ workspace: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { workspace: slug } = await params;
  const workspace = await getWorkspace(slug);
  return { title: workspace ? `FAQ Modération · ${workspace.name}` : "FAQ Modération" };
}

export default async function FaqModerationPage({ params }: { params: Params }) {
  const { workspace: slug } = await params;
  await requireViewer();
  const workspace = await getWorkspace(slug);
  if (!workspace) notFound();
  await requirePageAccess(workspace, FAQ_MODERATION_PAGE_KEY);

  const supabase = await createClient();
  const { data: moderationClient } = await supabase
    .from("moderation_clients")
    .select("id, name")
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (!moderationClient) notFound();

  const clientId = (moderationClient as { id: string }).id;
  const [{ data: entries }, { data: categories }] = await Promise.all([
    supabase
      .from("faq_entries")
      .select("*")
      .eq("client_id", clientId)
      .eq("active", true)
      .is("deleted_at", null)
      .order("title")
      .limit(500),
    supabase
      .from("faq_categories")
      .select("id, name")
      .eq("client_id", clientId)
      .order("position"),
  ]);

  return (
    <FaqClientView
      entries={(entries ?? []) as unknown as FaqEntry[]}
      categories={(categories ?? []) as { id: string; name: string }[]}
      canReview={workspace.role !== "owner"}
    />
  );
}
