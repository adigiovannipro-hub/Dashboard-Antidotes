import Link from "next/link";

import { Logo } from "@/components/ds/logo";
import type { Dictionary } from "@/i18n/types";
import { localePath, type Locale } from "@/i18n/locale";
import { HeaderTheme } from "./header-theme";
import { MobileMenu } from "./mobile-menu";

/**
 * L'en-tête : le logotype, quatre ancres, la langue, et un seul bouton —
 * celui du quiz. Collant, en verre de la charte, et fin : il est payé sur
 * chaque écran. Il passe d'un univers à l'autre avec la section dessous.
 */
export function Header({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const other: Locale = locale === "fr" ? "en" : "fr";
  const links = [
    { href: "#services", label: dict.nav.services },
    { href: "#cas", label: dict.nav.cases },
    { href: "#methode", label: dict.nav.method },
    { href: "#faq", label: dict.nav.faq },
  ];
  return (
    <header id="entete" className="theme-dark sticky top-0 z-40 transition-colors duration-(--motion)">
      <div className="glass border-b border-glass-border/40 transition-[background,box-shadow] duration-(--motion)">
        <div className="container-site flex h-16 items-center justify-between gap-4">
          <Link href={localePath(locale)} className="text-text" aria-label="antidotes">
            <Logo height={21} />
          </Link>
          <nav aria-label="Sections" className="hidden items-center gap-8 md:flex">
            {links.map((link) => (
              <a key={link.href} href={link.href} className="type-small font-medium text-text-2 transition-colors duration-(--motion) hover:text-text">
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href={localePath(other)}
              hrefLang={other}
              aria-label={`${dict.nav.switchLabel}, ${dict.nav.switchAria}`}
              className="type-overline rounded-pill border border-line-strong px-3 py-2 text-text-2 transition-colors duration-(--motion) hover:border-text-3 hover:text-text"
            >
              {dict.nav.switchLabel}
            </Link>
            <a
              href="#note"
              className="type-small hidden rounded-pill bg-btn px-4.5 py-2.5 font-semibold text-btn-text transition-colors duration-(--motion) hover:bg-btn-hover md:inline-flex"
            >
              {dict.nav.cta}
            </a>
            <MobileMenu links={links} cta={{ href: "#note", label: dict.nav.cta }} labels={{ menu: dict.nav.menu, close: dict.nav.close }} />
          </div>
        </div>
      </div>
      <HeaderTheme targetId="entete" />
    </header>
  );
}
