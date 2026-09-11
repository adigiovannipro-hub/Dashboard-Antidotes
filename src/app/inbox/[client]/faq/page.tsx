import { notFound, redirect } from "next/navigation";

import { requireModerationClient } from "@/lib/moderation/access";
import { createClient } from "@/lib/supabase/server";

/**
 * La FAQ vit dans l'espace du client, page du menu depuis le 11/09. Cette
 * route ne sert plus qu'à rediriger les anciens liens, `?entree=` compris :
 * le fil de modération pointe ici, et l'entrée s'ouvre là-bas.
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

  redirect(
    `/espace/${(workspace as { slug: string }).slug}/faq${entree ? `?entree=${entree}` : ""}`,
  );
}
