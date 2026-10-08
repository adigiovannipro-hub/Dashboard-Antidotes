import Link from "next/link";

import { Logo } from "@/components/ds/logo";
import type { Dictionary } from "@/i18n/types";
import { localePath, type Locale } from "@/i18n/locale";
import { MobileMenu } from "./mobile-menu";

/**
 * L'en-tête : logo, quatre ancres, la langue, et un seul bouton — celui du
 * tunnel. Collant, en verre, et fin : il est payé sur chaque écran.
 */
export function Header({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const other: Locale = locale === "fr" ? "en" : "fr";
  const links = [
    { href: "#cas", label: dict.nav.cases },
    { href: "#services", label: dict.nav.services },
    { href: "#methode", label: dict.nav.method },
    { href: "#outils", label: dict.nav.tools },
    { href: "#faq", label: dict.nav.faq },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink-0/70 backdrop-blur-xl">
      <div className="container-site flex h-16 items-center justify-between gap-4">
        <Link href={localePath(locale)} className="text-text">
          <Logo height={20} />
        </Link>
        <nav aria-label="Sections" className="hidden items-center gap-7 md:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="type-small text-text-2 transition-colors duration-(--motion) hover:text-text">
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href={localePath(other)}
            hrefLang={other}
            aria-label={`${dict.nav.switchLabel} – ${dict.nav.switchAria}`}
            className="type-caption rounded-pill border border-line px-3 py-1.5 text-text-2 transition-colors duration-(--motion) hover:border-line-strong hover:text-text"
          >
            {dict.nav.switchLabel}
          </Link>
          <a
            href="#note"
            className="type-small hidden rounded-pill bg-text px-4 py-2 font-medium text-text-on-light transition-transform duration-(--motion) hover:-translate-y-px md:inline-flex"
          >
            {dict.nav.cta}
          </a>
          <MobileMenu links={links} cta={{ href: "#note", label: dict.nav.cta }} labels={{ menu: dict.nav.menu, close: dict.nav.close }} />
        </div>
      </div>
    </header>
  );
}
