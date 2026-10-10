import Link from "next/link";

import { CoulureWordmark } from "@/components/brand/coulure-wordmark";
import { Rich } from "@/components/brand/rich";
import type { Dictionary } from "@/i18n/types";
import { localePath, type Locale } from "@/i18n/locale";
import { LEGAL_ENTITY } from "@/lib/legal/entity";

/**
 * Le pied de page retourne à la Profondeur : les liens, puis le logotype
 * sur toute la largeur, dont le bas des lettres coule en peinture irisée
 * (r-09, proposition « Coulure »).
 */
export function Footer({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const other: Locale = locale === "fr" ? "en" : "fr";
  const privacy = localePath(locale, locale === "fr" ? "/confidentialite" : "/privacy");
  const terms = localePath(locale, locale === "fr" ? "/cgu" : "/terms");
  const link = "type-small text-text-2 underline-offset-4 transition-colors duration-(--motion) hover:text-text hover:underline";
  return (
    <footer data-univers="sombre" className="theme-dark relative isolate overflow-hidden rounded-t-[clamp(28px,4vw,56px)] bg-bg text-text">
      <div className="container-site pt-10 md:pt-12">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-10">
          <div className="md:col-span-6">
            <p className="type-h2 max-w-md text-text">
              <Rich text={dict.footer.tagline} />
            </p>
            <p className="type-data mt-3 text-text-3">{dict.footer.madeBy}</p>
          </div>
          <ul className="space-y-1.5 md:col-span-3">
            <li>
              <a href={`mailto:${LEGAL_ENTITY.email}`} className={link}>
                {dict.footer.contact}
              </a>
            </li>
            <li>
              <a href="https://www.linkedin.com/in/alessandrodigiovanni" rel="me noopener" target="_blank" className={link}>
                {dict.footer.linkedin}
              </a>
            </li>
            <li>
              <Link href={localePath(other)} hrefLang={other} className={link}>
                {other === "en" ? "English" : "Français"}
              </Link>
            </li>
          </ul>
          <ul className="space-y-1.5 md:col-span-3">
            <li>
              <Link href={privacy} className={link}>
                {dict.footer.privacy}
              </Link>
            </li>
            <li>
              <Link href={terms} className={link}>
                {dict.footer.terms}
              </Link>
            </li>
            <li className="type-data pt-1 text-text-3">{dict.footer.based}</li>
          </ul>
        </div>
        <p className="type-data mt-7 text-text-3">
          © {new Date().getUTCFullYear()} {dict.footer.copyright}. {dict.footer.rights}
        </p>
      </div>
      <div className="container-site mt-3">
        <CoulureWordmark />
      </div>
    </footer>
  );
}
