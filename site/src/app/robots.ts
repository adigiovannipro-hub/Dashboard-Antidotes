import type { MetadataRoute } from "next";

import { SITE_URL } from "@/i18n/locale";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/rdv/", "/en/booking/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
