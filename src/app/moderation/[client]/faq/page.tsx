import { notFound, redirect } from "next/navigation";

import { requireModerationClient } from "@/lib/moderation/access";
import { createClient } from "@/lib/supabase/server";

/**
 * La FAQ vit dans le Planning de l'espace, à côté du planning éditorial —
 * comme le board Monday d'origine. Cette route ne sert plus qu'à rediriger
 * les anciens liens, `?entree=` compris : le fil de modération pointe ici,
 * et l'entrée s'ouvre là-bas.
 */
export default async function FaqPage({
  params,
  searchParams,
}: {
  params: Promise<{ client: string }>;
  searchParams: Promise<{ entree?: string }>;
}) {
  const { client: slug } = await params;
  const { entree } = await searchParams;
  const { client } = await requireModerationClient(slug);

  if (!client.workspace_id) notFound();

  const supabase = await createClient();
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("slug")
    .eq("id", client.workspace_id)
    .maybeSingle();
  if (!workspace) notFound();

  const { data: board } = await supabase
    .from("planning_boards")
    .select("slug")
    .eq("workspace_id", client.workspace_id)
    .eq("kind", "faq")
    .maybeSingle();
  if (!board) notFound();

  redirect(
    `/espace/${(workspace as { slug: string }).slug}/planning/${(board as { slug: string }).slug}${
      entree ? `?entree=${entree}` : ""
    }`,
  );
}
