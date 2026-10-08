import { en } from "./en";
import { fr } from "./fr";
import type { Locale } from "./locale";
import type { Dictionary } from "./types";

export function getDictionary(locale: Locale): Dictionary {
  return locale === "en" ? en : fr;
}

export type { Dictionary } from "./types";
export { LOCALES, localePath, SITE_URL, type Locale } from "./locale";
