import Link from "next/link";

import type { Dictionary } from "@/i18n/types";
import { localePath, type Locale } from "@/i18n/locale";
import { LEGAL_ENTITY } from "@/lib/legal/entity";
import { FuseWordmark } from "./fuse-wordmark";

export function Footer({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const other: Locale = locale === "fr" ? "en" : "fr";
  const privacy = localePath(locale, locale === "fr" ? "/confidentialite" : "/privacy");
  const terms = localePath(locale, locale === "fr" ? "/cgu" : "/terms");
  const link = "type-small text-text-2 underline-offset-4 transition-colors duration-(--motion) hover:text-text hover:underline";
  return (
    <footer className="relative overflow-hidden border-t border-line">
      <div className="container-site pt-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          <div>
            <p className="type-lead text-text">{dict.footer.tagline}</p>
            <p className="type-caption mt-3 text-text-3">{dict.footer.madeBy}</p>
          </div>
          <ul className="space-y-2">
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
          <ul className="space-y-2">
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
            <li className="type-caption pt-2 text-text-3">{dict.footer.based}</li>
          </ul>
        </div>
        <p className="type-caption mt-10 text-text-3">
          © {new Date().getUTCFullYear()} {dict.footer.copyright}. {dict.footer.rights}
        </p>
      </div>
      {/* Le logotype prend toute la largeur ; l'air au-dessus est celui où montent les volutes. */}
      <div className="container-site -mt-2 pb-4">
        <FuseWordmark />
      </div>
    </footer>
  );
}
