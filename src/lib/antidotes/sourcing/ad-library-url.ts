/**
 * Lire une URL de la Bibliothèque publicitaire Meta.
 *
 * L'utilisateur regarde ses concurrents dans la Bibliothèque, dans son
 * navigateur, et colle l'adresse de la barre dans la campagne : le pays et la
 * requête de cette adresse disent sur quel marché vérifier les publicités
 * actives, l'identifiant d'annonceur désigne une page précise. On lit ce que
 * l'URL porte, sans rien deviner — un paramètre absent est `null`, une
 * adresse qui n'est pas celle de la Bibliothèque est refusée en bloc.
 *
 * Module pur, testé.
 */

export type AdLibraryActiveStatus = "active" | "inactive" | "all";

export type ParsedAdLibraryUrl = {
  /** ISO 3166-1 alpha-2, majuscules ; `country=ALL` vaut `null`. */
  country: string | null;
  query: string | null;
  pageId: string | null;
  activeStatus: AdLibraryActiveStatus | null;
};

/** `facebook.com` et tous ses sous-domaines — `www`, `m`, `fr-fr`, `web`… */
function isFacebookHost(host: string): boolean {
  const lower = host.toLowerCase();
  return lower === "facebook.com" || lower.endsWith(".facebook.com");
}

function nonEmpty(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export function parseAdLibraryUrl(url: string): ParsedAdLibraryUrl | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (!isFacebookHost(parsed.hostname)) return null;
  if (!/^\/ads\/library\/?$/i.test(parsed.pathname)) return null;

  const params = parsed.searchParams;

  const rawCountry = nonEmpty(params.get("country"))?.toUpperCase() ?? null;
  const country = rawCountry !== null && /^[A-Z]{2}$/.test(rawCountry) ? rawCountry : null;

  const rawPageId = nonEmpty(params.get("view_all_page_id"));
  const pageId = rawPageId !== null && /^\d+$/.test(rawPageId) ? rawPageId : null;

  const rawStatus = nonEmpty(params.get("active_status"))?.toLowerCase() ?? null;
  const activeStatus =
    rawStatus === "active" || rawStatus === "inactive" || rawStatus === "all" ? rawStatus : null;

  return { country, query: nonEmpty(params.get("q")), pageId, activeStatus };
}

/** Ce que l'écran affiche à côté du champ : « FR · lunettes », « Tous pays · page 123 ». */
export function describeAdLibraryUrl(parsed: ParsedAdLibraryUrl): string {
  const parts = [parsed.country ?? "Tous pays"];
  if (parsed.query) parts.push(parsed.query);
  else if (parsed.pageId) parts.push(`page ${parsed.pageId}`);
  return parts.join(" · ");
}
