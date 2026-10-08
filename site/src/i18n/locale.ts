export type Locale = "fr" | "en";

export const LOCALES: readonly Locale[] = ["fr", "en"];

/** Le préfixe d'URL d'une langue : le français est à la racine. */
export function localePath(locale: Locale, path = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return locale === "fr" ? clean : `/en${clean === "/" ? "" : clean}`;
}

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://antidotes.agency";
