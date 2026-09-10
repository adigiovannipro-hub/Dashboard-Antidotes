import { redirect } from "next/navigation";

/** Le brouillon s'ouvre désormais dans le panneau de la page unique. */
export default async function LegacyDraftPage({ params }: { params: Promise<{ post: string }> }) {
  const { post } = await params;
  redirect(`/antidotes/inbound?brouillon=${post}`);
}
