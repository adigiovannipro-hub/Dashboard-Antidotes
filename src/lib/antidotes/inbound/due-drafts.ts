/**
 * Les brouillons dus : ce que le passage horaire doit publier maintenant.
 *
 * Pur et testé, parce que c'est la règle qui décide d'un envoi public — et
 * qu'une règle qui décide d'un envoi public ne se relit pas, elle se teste.
 * Trois conditions, toutes nécessaires : un post LinkedIn (un script de reel
 * se tourne, il ne se publie pas), **approuvé** (la validation humaine reste
 * le passage obligé), et daté d'un instant déjà passé.
 */

import type { GeneratedPost } from "../types";

export type DueDraft = Pick<GeneratedPost, "id" | "format" | "status" | "scheduled_at" | "content">;

export function dueDrafts<T extends DueDraft>(drafts: readonly T[], now: Date): T[] {
  const at = now.getTime();
  return drafts
    .filter(
      (draft) =>
        draft.format === "linkedin_post" &&
        draft.status === "approved" &&
        draft.scheduled_at !== null &&
        Date.parse(draft.scheduled_at) <= at,
    )
    .sort((a, b) => Date.parse(a.scheduled_at!) - Date.parse(b.scheduled_at!));
}
