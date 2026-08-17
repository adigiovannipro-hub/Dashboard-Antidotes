import { permanentRedirect } from "next/navigation";

/**
 * L'inbox par client n'existe plus : la boîte est croisée, le client est un
 * filtre. Les anciens liens — favoris, messages partagés — atterrissent au
 * bon endroit. La FAQ, elle, reste par client (`./faq`).
 */
export default async function ModerationClientPage({
  params,
}: {
  params: Promise<{ client: string }>;
}) {
  const { client } = await params;
  permanentRedirect(`/moderation?client=${encodeURIComponent(client)}`);
}
