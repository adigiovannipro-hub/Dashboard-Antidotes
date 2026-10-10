import Link from "next/link";

import { Logo } from "@/components/ds/logo";
import type { Dictionary } from "@/i18n/types";
import { localePath, type Locale } from "@/i18n/locale";
import { HeaderTheme } from "./header-theme";
import { MobileMenu } from "./mobile-menu";

/**
 * L'en-tête : le logotype, quatre ancres, la langue, et un seul bouton —
 * celui du quiz. Une pastille de verre qui flotte au-dessus de la page
 * (charte r-18) dans une bande de 64 px restée dans le flux. Il passe d'un
 * univers à l'autre avec la section dessous ; les styles vivent dans
 * `styles/header.css`.
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
    <header id="entete" className="site-header theme-dark sticky top-0 z-40 h-16">
      <div className="nav-wrap container-site">
        <div className="nav-pill">
          <Link href={localePath(locale)} className="nav-logo shrink-0 rounded-pill" aria-label="antidotes">
            <Logo height={22} />
          </Link>
          {/* Les quatre ancres à partir de 1024 px : en dessous, elles passaient sur deux lignes. */}
          <nav aria-label="Sections" className="hidden items-center gap-1 lg:flex">
            {links.map((link) => (
              <a key={link.href} href={link.href} className="nav-link">
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href={localePath(other)} hrefLang={other} aria-label={`${dict.nav.switchLabel}, ${dict.nav.switchAria}`} className="nav-lang">
              {dict.nav.switchLabel}
            </Link>
            <a href="#note" className="btn-primary nav-cta hidden items-center sm:inline-flex">
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
