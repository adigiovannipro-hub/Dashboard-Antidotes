import "server-only";

/**
 * Programmation des publications — stub assumé.
 *
 * La phase « programmation » du cycle est un job technique, pas un appel au
 * modèle : elle pousse les posts validés vers les APIs des plateformes. Aucune
 * API de publication n'est branchée aujourd'hui ; ce module journalise ce qui
 * serait programmé et expose l'interface qu'un connecteur Meta remplira plus
 * tard. Il n'écrit rien, ne change aucun statut : dire qu'un post est
 * programmé sans l'avoir programmé serait un faux positif.
 */

export type SchedulablePost = {
  subjectId: string;
  workspaceId: string;
  platform: string;
  name: string;
  /** `YYYY-MM-DD`, jour de publication prévu. */
  scheduledOn: string | null;
  wording: string | null;
  visualUrls: string[];
};

export type ScheduleOutcome = {
  /** Posts que le connecteur aurait programmés. */
  accepted: SchedulablePost[];
  /** Posts refusés avant tout appel, avec la raison. */
  rejected: { post: SchedulablePost; reason: string }[];
  /** `true` tant qu'aucune API réelle n'est branchée. */
  dryRun: true;
};

/**
 * Interface du futur connecteur : mêmes entrées, mêmes sorties, seul le corps
 * changera quand l'API Meta sera branchée.
 */
export async function schedulePublications(
  posts: SchedulablePost[],
): Promise<ScheduleOutcome> {
  const accepted: SchedulablePost[] = [];
  const rejected: ScheduleOutcome["rejected"] = [];

  for (const post of posts) {
    if (!post.scheduledOn) {
      rejected.push({ post, reason: "Aucune date de publication." });
      continue;
    }
    if (!post.wording || post.wording.trim() === "") {
      rejected.push({ post, reason: "Wording absent." });
      continue;
    }
    accepted.push(post);
    console.log(
      `[programmation:stub] ${post.platform} · « ${post.name} » serait programmé le ${post.scheduledOn} (aucun appel réel).`,
    );
  }

  return { accepted, rejected, dryRun: true };
}
