import type { Metadata } from "next";

import { InboundScreen } from "@/components/antidotes/inbound-screen";
import { requireAntidotesAccess } from "@/lib/antidotes/access";
import { getInboundData } from "@/lib/antidotes/inbound/queries";

export const metadata: Metadata = { title: "Inbound · Antidotes" };

/**
 * L'inbound sur une seule page — et sur une seule lecture.
 *
 * La page ne lit plus les paramètres d'URL : filtres, tri, vue et ligne
 * ouverte sont de l'affichage, et l'écran a déjà tout ce qu'il faut pour les
 * appliquer en mémoire. C'est ce qui rend le panneau instantané — avant,
 * `?post=` relançait le rendu serveur complet pour retrouver une ligne que la
 * page portait déjà.
 */
export default async function InboundPage() {
  const context = await requireAntidotesAccess();
  const data = await getInboundData({ orgId: context.orgId });
  return <InboundScreen data={data} />;
}
