/**
 * Adresse de l'API Airwallex selon l'environnement.
 *
 * Séparée du transport, qui porte `server-only` : cette décision est une
 * fonction pure de l'environnement, et elle a coûté assez cher pour mériter
 * ses tests. Le bac à sable d'Airwallex s'appelle « demo » et vit sur
 * `api-demo.airwallex.com` ; le code visait `api.sandbox.airwallex.com`,
 * inventé de toutes pièces — le premier appel réel y a reçu une page HTML
 * « 403 Forbidden », la signature d'un hôte qui n'est pas cette API.
 *
 * `AIRWALLEX_BASE_URL` permet de trancher sans redéployer le jour où ces
 * adresses changent : un nom d'hôte n'est pas une constante de notre ressort.
 */
export function baseUrl(): string {
  const override = process.env.AIRWALLEX_BASE_URL?.trim();
  if (override) return override.replace(/\/$/, "");

  return process.env.AIRWALLEX_ENV === "production"
    ? "https://api.airwallex.com"
    : "https://api-demo.airwallex.com";
}
