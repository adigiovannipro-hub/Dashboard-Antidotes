import "server-only";

import { getModerationContext } from "@/lib/moderation/access";
import { ACTIONABLE_STATUSES } from "@/lib/moderation/types";
import { DONE_STATUSES, EXCLUDED_STATUSES } from "@/lib/planning/types";
import { createClient } from "@/lib/supabase/server";
import { todayInParis } from "./dates";

/**
 * Les compteurs du rail de navigation.
 *
 * Ils répondent à la seule question qu'on se pose depuis n'importe quelle page :
 * « est-ce qu'il me reste quelque chose ? ». Sans eux, il faut ouvrir l'accueil
 * pour l'apprendre, et on l'ouvre donc en boucle.
 *
 * Trois comptages en `head: true` — Postgres rend le nombre, jamais les lignes.
 * C'est ce qui rend acceptable de les jouer sur **chaque** page : le rail est
 * partout, ces requêtes le sont aussi.
 *
 * Ils suivent la RLS comme le reste : un compteur ne doit pas révéler l'exis-
 * tence de lignes qu'on n'a pas le droit de lire.
 */

export type NavBadges = {
  /** Tâches ouvertes et publications du jour, retards compris. */
  travail: number;
  /** Conversations à gérer, `null` si aucun compte de modération. */
  moderation: number | null;
};

/**
 * Ce qui est « à faire aujourd'hui » : échu ou échéant ce jour, pas au-delà.
 *
 * Une tâche de jeudi ne compte pas mardi — elle n'est pas en retard et rien
 * n'appelle à l'ouvrir. En revanche une tâche de la semaine dernière compte
 * toujours : c'est même la seule qui presse.
 */
export async function getNavBadges(): Promise<NavBadges> {
  const today = todayInParis();
  const supabase = await createClient();

  const [tasks, publications, moderation] = await Promise.all([
    supabase
      .from("work_tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .lte("due_date", today),
    supabase
      .from("planning_subjects")
      .select("id", { count: "exact", head: true })
      .lte("scheduled_on", today)
      .not("scheduled_on", "is", null)
      // Ni publié ni écarté : ce qui doit encore partir.
      .not("status", "in", `(${[...DONE_STATUSES, ...EXCLUDED_STATUSES].join(",")})`),
    countModeration(),
  ]);

  return {
    travail: (tasks.count ?? 0) + (publications.count ?? 0),
    moderation,
  };
}

/**
 * Conversations actionnables, tous clients de modération confondus.
 *
 * `null` — et non zéro — quand le visiteur n'a aucun client : la pastille
 * disparaît alors, au lieu d'annoncer « 0 » sur un module qui n'existe pas
 * pour lui.
 */
async function countModeration(): Promise<number | null> {
  const context = await getModerationContext();
  if (context.clients.length === 0) return null;

  const supabase = await createClient();
  const { count } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .in("status", ACTIONABLE_STATUSES);

  return count ?? 0;
}
