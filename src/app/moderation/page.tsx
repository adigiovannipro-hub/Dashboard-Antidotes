import { redirect } from "next/navigation";

import { requireModeration } from "@/lib/moderation/access";

/** Le module s'ouvre directement sur le premier client : pas d'écran de choix. */
export default async function ModerationIndexPage() {
  const { clients } = await requireModeration();
  redirect(`/moderation/${clients[0]!.slug}`);
}
