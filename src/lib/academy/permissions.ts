/**
 * Qui voit quoi dans l'Academy — décisions **pures**, sans directive, donc
 * lisibles dans un test comme `moderation/permissions.ts`.
 *
 * Elles vivent ici et non dans `access.ts` parce que ce dernier porte
 * `import "server-only"` : la règle qui décide de ce qu'une élève atteint est
 * précisément celle qu'on veut pouvoir éprouver sans base ni session.
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

/**
 * La ressource visée appartient-elle bien à cette personne ?
 *
 * Deux conditions, et la première se néglige facilement : l'organisation, puis
 * la formation. Les identifiants viennent du navigateur — une élève peut en
 * poster n'importe lequel — et la RLS ne filtre plus rien en accès ouvert.
 */
export function canReachLesson(
  context: AcademyAccess,
  lesson: { org_id: string; course_id: string },
): boolean {
  return lesson.org_id === context.orgId && canReadCourse(context, lesson.course_id);
}

/**
 * La chaîne du publié : une leçon ne se lit que si son module et son cours le
 * sont aussi. L'owner la traverse — c'est lui qui prépare les brouillons.
 *
 * C'est la règle de la RLS (0057), rejouée en code parce que l'accès ouvert la
 * désarme : sans elle, un brouillon fuirait par une route API.
 */
export function isPublishedChain(
  context: AcademyAccess,
  chain: { lesson: boolean; module: boolean; course: boolean },
): boolean {
  if (context.isAdmin) return true;
  return chain.lesson && chain.module && chain.course;
}
