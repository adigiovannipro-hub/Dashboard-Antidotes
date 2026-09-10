import type { Metadata } from "next";

import { InboundScreen } from "@/components/antidotes/inbound-screen";
import { requireAntidotesAccess } from "@/lib/antidotes/access";
import { parseMonthKey } from "@/lib/antidotes/inbound/calendar";
import { parseContentFilters } from "@/lib/antidotes/inbound/filters";
import { getInboundData, getInboundPost, getStudioPost } from "@/lib/antidotes/inbound/queries";
import { INBOUND_VIEWS, parseInboundView } from "@/lib/antidotes/inbound/views";

export const metadata: Metadata = { title: "Inbound · Antidotes" };

type Search = Promise<Record<string, string | string[] | undefined>>;

const single = (value: string | string[] | undefined): string | undefined =>
  typeof value === "string" ? value : undefined;

/**
 * L'inbound sur une seule page.
 *
 * Radar, studio et bibliothèque étaient trois écrans pour un seul geste :
 * regarder ce qui marche chez les autres, en tirer un post ou un script,
 * le valider, le publier. Ils tiennent maintenant dans une page à **vues**
 * (`?vue=`) — contenus, comptes, sujets, mes posts, calendrier, consignes —
 * dont le tableau se filtre dans l'URL et dont chaque ligne ouvre le même
 * panneau latéral (`?post=`, `?sujet=`, `?brouillon=`, `?mien=`).
 *
 * Une seule lecture sert les six vues : elles se choisissent sans
 * aller-retour serveur, et le tableau se range en mémoire.
 */
export default async function InboundPage({ searchParams }: { searchParams: Search }) {
  const [context, query] = await Promise.all([requireAntidotesAccess(), searchParams]);
  const view = parseInboundView(single(query.vue));
  const filters = parseContentFilters({
    reseau: single(query.reseau),
    jours: single(query.jours),
    vues: single(query.vues),
    likes: single(query.likes),
    commentaires: single(query.commentaires),
    tri: single(query.tri),
  });
  const month = parseMonthKey(single(query.mois), new Date());


  const openPost = single(query.post) ?? single(query.mien) ?? null;
  const openDraft = single(query.brouillon) ?? null;
  const openTopic = single(query.sujet) ?? null;

  const [data, postDetail, draftDetail] = await Promise.all([
    getInboundData({ orgId: context.orgId }),
    openPost ? getInboundPost({ orgId: context.orgId, postId: openPost }) : Promise.resolve(null),
    openDraft ? getStudioPost({ orgId: context.orgId, postId: openDraft }) : Promise.resolve(null),
  ]);

  return (
    <InboundScreen
      view={view}
      views={INBOUND_VIEWS}
      filters={filters}
      month={month}
      data={data}
      postDetail={postDetail}
      draftDetail={draftDetail}
      openTopicId={openTopic}
    />
  );
}
