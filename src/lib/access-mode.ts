/**
 * Accès ouvert.
 *
 * L'application s'ouvre sans authentification pendant la construction : le
 * login par magic link ajoutait une marche avant même de pouvoir regarder
 * l'écran.
 *
 * Ce que cela implique, sans détour : **toute personne qui a l'URL voit tout**.
 * Le planning, les budgets de sponsorisation, les captions, les chiffres de
 * performance de chaque espace, la trésorerie. L'isolation entre clients
 * repose sur la RLS, qui a besoin d'une session pour distinguer qui demande
 * quoi — sans session, les lectures passent en service_role et la RLS ne
 * s'applique plus.
 *
 * La décision est **ici, en clair et versionnée**, plutôt que dans l'absence
 * d'une variable d'environnement : une application ouverte parce que personne
 * n'a pensé à la fermer et une application ouverte parce qu'on l'a écrit ne se
 * relisent pas de la même façon. Passer cette constante à `false` referme
 * l'application partout à la fois, et c'est le geste à faire avant le deuxième
 * client.
 */
const OUVERT_PENDANT_LA_CONSTRUCTION = true;

/**
 * `ANTIDOTES_OPEN_ACCESS` permet de trancher sans toucher au code — utile pour
 * refermer un environnement précis (`false`) sans redéployer les autres. Non
 * positionnée, c'est la constante ci-dessus qui décide.
 */
export function isOpenAccess(): boolean {
  const choix = process.env.ANTIDOTES_OPEN_ACCESS;
  if (choix !== undefined) return choix === "true";
  return OUVERT_PENDANT_LA_CONSTRUCTION;
}
