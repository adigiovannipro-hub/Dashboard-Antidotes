/**
 * Accès ouvert.
 *
 * L'application peut s'ouvrir sans authentification, le temps de la mise au
 * point : le login par magic link ajoutait une marche avant même de pouvoir
 * regarder l'écran.
 *
 * Ce que cela implique, sans détour : **toute personne qui a l'URL voit tout**.
 * Le planning, les budgets de sponsorisation, les captions, les chiffres de
 * performance de chaque espace. L'isolation entre clients repose sur la RLS,
 * qui a besoin d'une session pour distinguer qui demande quoi — sans session,
 * les lectures passent en service_role et la RLS ne s'applique plus.
 *
 * C'est pourquoi l'ouverture se **demande**, elle ne se subit pas :
 * `ANTIDOTES_OPEN_ACCESS=true` dans l'environnement, et rien d'autre. Un
 * déploiement qui ne dit rien est fermé.
 *
 * La variable précédente, `ANTIDOTES_REQUIRE_LOGIN`, disait l'inverse et
 * ouvrait par défaut : un environnement où elle manquait — un nouvel aperçu,
 * un environnement fraîchement créé — était public sans que personne ne l'ait
 * décidé. Elle n'est plus lue, et la laisser en place est sans effet.
 */
export function isOpenAccess(): boolean {
  return process.env.ANTIDOTES_OPEN_ACCESS === "true";
}
