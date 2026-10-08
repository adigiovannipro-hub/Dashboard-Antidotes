import type { Metadata } from "next";

import { Home } from "@/components/site/home";
import { getDictionary } from "@/i18n";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata("fr", "/");

export default function Page() {
  return <Home dict={getDictionary("fr")} locale="fr" />;
}
