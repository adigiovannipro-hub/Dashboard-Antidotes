/**
 * Deux domaines, un seul déploiement.
 *
 * `app.antidotes.agency` sert l'application ; `antidotes.agency` est la
 * vitrine — une page noire en attendant la landing, plus les deux pages
 * légales, qui y ont leur adresse définitive : c'est celle qu'on déclare une
 * fois pour toutes chez Meta, TikTok, LinkedIn et Google, et elle ne devra pas
 * bouger le jour où la landing arrive. Tout autre chemin de la vitrine part
 * vers l'application, au même chemin : un lien tapé sans `app.` aboutit.
 *
 * `www` est redirigé vers la racine par Vercel lui-même ; il figure ici en
 * ceinture, pour qu'un réglage de domaine retiré ne serve pas l'application
 * sous le nom de la vitrine.
 */
export const VITRINE_HOSTS: readonly string[] = [
  "antidotes.agency",
  "www.antidotes.agency",
];

/** Les chemins que la vitrine sert elle-même, en plus de sa page d'accueil. */
export const VITRINE_PATHS: readonly string[] = ["/confidentialite", "/cgu"];

/** La route interne qui rend la page d'accueil de la vitrine. */
export const VITRINE_PAGE = "/vitrine";

export type VitrineRoute =
  | { kind: "page" }
  | { kind: "served" }
  | { kind: "app"; url: string };

/** L'en-tête `Host` désigne-t-il la vitrine ? Port et casse ignorés. */
export function isVitrineHost(host: string | null): boolean {
  if (!host) return false;
  const name = host.trim().toLowerCase().replace(/:\d+$/, "");
  return VITRINE_HOSTS.includes(name);
}

/**
 * Ce que la vitrine fait d'un chemin : sa page, une page qu'elle sert, ou un
 * renvoi vers l'application au même chemin, requête comprise.
 */
export function routeVitrine(
  pathname: string,
  search: string,
  appOrigin: string,
): VitrineRoute {
  if (pathname === "/" || pathname === "") return { kind: "page" };
  if (
    VITRINE_PATHS.some(
      (base) => pathname === base || pathname.startsWith(`${base}/`),
    )
  ) {
    return { kind: "served" };
  }
  const origin = appOrigin.replace(/\/+$/, "");
  return { kind: "app", url: `${origin}${pathname}${search}` };
}
