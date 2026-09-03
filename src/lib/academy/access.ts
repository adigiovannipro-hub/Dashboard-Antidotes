import "server-only";

import { cache } from "react";
import { notFound } from "next/navigation";

import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Résolution de l'accès à l'Academy.
 *
 * Trois profils, et non plus deux :
 *
 * - **L'owner** administre : il crée, édite, publie, téléverse, inscrit. Il
 *   voit tout, brouillons compris.
 * - **Un membre de l'organisation** suit les formations publiées : c'est
 *   l'équipe, l'Academy lui est ouverte en entier.
 * - **Une élève** — quelqu'un qui a acheté une formation — ne voit que **les
 *   formations où elle est inscrite**, et rien d'autre dans Antidotes. Elle
 *   n'a aucune ligne dans `organization_members` : la Finance, les Reçus, les
 *   espaces clients n'existent pas pour elle.
 *
 * Un client d'espace n'est ni l'un ni l'autre : pour lui le module n'existe
 * pas, et les routes répondent 404, jamais 403.
 *
 * La RLS des migrations 0057 et 20260903b applique les mêmes frontières côté
 * base ; ceci ne fait que les exprimer côté écran.
 */

export type AcademyAccess = {
  orgId: string;
  userId: string;
  /** Peut créer, éditer, publier, téléverser, inscrire — le back-office. */
  isAdmin: boolean;
  /**
   * Les formations lisibles, ou `null` pour « toutes celles de
   * l'organisation » — le cas de l'owner et des membres de l'équipe.
   */
  courseIds: string[] | null;
  /** Élève : inscrite à une formation, membre d'aucune organisation. */
  isStudent: boolean;
};

export const getAcademyContext = cache(
  async (): Promise<AcademyAccess | null> => {
    const viewer = await getViewer();
    if (!viewer) return null;

    if (viewer.isOwner && viewer.ownedOrgIds.length > 0) {
      return {
        orgId: viewer.ownedOrgIds[0]!,
        userId: viewer.user.id,
        isAdmin: true,
        courseIds: null,
        isStudent: false,
      };
    }

    // Les filtres `user_id` sont explicites et non délégués à la RLS : en
    // accès ouvert le client de lecture est `service_role`, et sans eux la
    // requête rendrait les lignes de tout le monde.
    const supabase = await createClient();
    const { data: membership } = await supabase
      .from("organization_members")
      .select("org_id")
      .eq("user_id", viewer.user.id)
      .limit(1)
      .maybeSingle();

    if (membership) {
      return {
        orgId: membership.org_id,
        userId: viewer.user.id,
        isAdmin: false,
        courseIds: null,
        isStudent: false,
      };
    }

    const { data: enrollments } = await supabase
      .from("academy_enrollments")
      .select("org_id, course_id")
      .eq("user_id", viewer.user.id)
      .eq("status", "active")
      .limit(50);

    const rows = enrollments ?? [];
    if (rows.length === 0) return null;

    return {
      orgId: rows[0]!.org_id,
      userId: viewer.user.id,
      isAdmin: false,
      courseIds: rows.map((row) => row.course_id),
      isStudent: true,
    };
  },
);

/** Exige l'accès au module. Renvoie un 404 sinon — jamais un 403. */
export async function requireAcademyAccess(): Promise<AcademyAccess> {
  const context = await getAcademyContext();
  if (!context) notFound();
  return context;
}

/** Exige le back-office. 404 pour un membre, une élève comme un client. */
export async function requireAcademyAdmin(): Promise<AcademyAccess> {
  const context = await requireAcademyAccess();
  if (!context.isAdmin) notFound();
  return context;
}

/**
 * Cette formation est-elle lisible par cette personne ?
 *
 * `courseIds === null` vaut « toutes » — l'owner et l'équipe. Sinon la liste
 * est celle des inscriptions actives, et une formation absente de la liste
 * doit se comporter comme une formation qui n'existe pas.
 */
export function canReadCourse(context: AcademyAccess, courseId: string): boolean {
  return context.courseIds === null || context.courseIds.includes(courseId);
}
