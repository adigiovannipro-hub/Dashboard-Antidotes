import type { Metadata } from "next";

import { SITE_URL, localePath, type Locale } from "@/i18n/locale";
import { getDictionary } from "@/i18n";

/** Les métadonnées d'une page, avec ses alternatives de langue (hreflang). */
export function pageMetadata(locale: Locale, path: "/" | "/confidentialite" | "/cgu" | "/privacy" | "/terms", override?: Partial<Pick<Metadata, "title" | "description">> & { noIndex?: boolean }): Metadata {
  const dict = getDictionary(locale);
  const frPath = path === "/privacy" ? "/confidentialite" : path === "/terms" ? "/cgu" : path;
  const enPath = path === "/confidentialite" ? "/privacy" : path === "/cgu" ? "/terms" : path;
  const canonical = `${SITE_URL}${localePath(locale, locale === "fr" ? frPath : enPath)}`;
  const title = override?.title ?? dict.meta.title;
  const description = override?.description ?? dict.meta.description;
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: {
      canonical,
      languages: {
        fr: `${SITE_URL}${localePath("fr", frPath)}`,
        en: `${SITE_URL}${localePath("en", enPath)}`,
        "x-default": `${SITE_URL}${localePath("fr", frPath)}`,
      },
    },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: "Antidotes",
      title: dict.meta.ogTitle,
      description: dict.meta.ogDescription,
      locale: locale === "fr" ? "fr_FR" : "en_US",
      alternateLocale: locale === "fr" ? ["en_US"] : ["fr_FR"],
    },
    twitter: { card: "summary_large_image", title: dict.meta.ogTitle, description: dict.meta.ogDescription },
    robots: override?.noIndex ? { index: false, follow: false } : { index: true, follow: true },
  };
}
