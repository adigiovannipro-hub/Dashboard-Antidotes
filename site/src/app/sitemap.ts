import type { MetadataRoute } from "next";

import { SITE_URL } from "@/i18n/locale";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages: { fr: string; en: string }[] = [
    { fr: "/", en: "/en" },
    { fr: "/confidentialite", en: "/en/privacy" },
    { fr: "/cgu", en: "/en/terms" },
  ];
  return pages.flatMap((page) => [
    { url: `${SITE_URL}${page.fr}`, lastModified: now, alternates: { languages: { fr: `${SITE_URL}${page.fr}`, en: `${SITE_URL}${page.en}` } } },
    { url: `${SITE_URL}${page.en}`, lastModified: now, alternates: { languages: { fr: `${SITE_URL}${page.fr}`, en: `${SITE_URL}${page.en}` } } },
  ]);
}
