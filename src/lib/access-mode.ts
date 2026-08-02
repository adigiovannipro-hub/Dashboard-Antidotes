/**
 * Accès ouvert.
 *
 * L'application s'ouvre sans authentification. Ce n'est pas un défaut de
 * conception, c'est un choix assumé le temps de la mise au point : le login par
 * magic link ajoutait une marche avant même de pouvoir regarder l'écran.
 *
 * Ce que cela implique, sans détour : **toute personne qui a l'URL voit tout**.
 * Le planning, les budgets de sponsorisation, les captions, les chiffres de
 * performance de chaque espace. L'isolation entre clients repose sur la RLS,
 * qui a besoin d'une session pour distinguer qui demande quoi — sans session,
 * les lectures passent en service_role et la RLS ne s'applique plus.
 *
 * Pour refermer : `ANTIDOTES_REQUIRE_LOGIN=true` dans l'environnement. Rien
 * d'autre à changer, tout le code d'authentification est resté en place.
 */
export function isOpenAccess(): boolean {
  return process.env.ANTIDOTES_REQUIRE_LOGIN !== "true";
}
