"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  PillIndicator,
  useOptimisticPill,
  usePillIndicator,
} from "@/components/ds/pill-indicator";
import { LinkPending } from "@/components/ds/route-progress";
import {
  ANTIDOTES_SECTIONS,
  OUTBOUND_PAGES,
  sectionOf,
} from "@/lib/antidotes/navigation";
import { cn } from "@/lib/utils";

/**
 * La navigation du pôle Antidotes — deux niveaux qui ne se ressemblent pas.
 *
 * En haut, les deux versants en pastilles à encre pleine dans la gouttière
 * creuse des sections : Outbound, Inbound. Un cran plus bas, et seulement
 * sous Outbound, les trois pages en onglets **soulignés** — le filet de
 * `BoardTabs`, pas une seconde rangée de pastilles qui mentirait sur la
 * hiérarchie. L'inbound n'a pas d'onglets : sa page est unique, ce sont
 * ses vues qui se choisissent dedans.
 *
 * Les deux listes viennent de `lib/antidotes/navigation.ts`, la même source
 * que le sous-menu du rail : un onglet n'existe ici que si sa page existe.
 */
export function AntidotesNav() {
  const pathname = usePathname();
  const settledSection = sectionOf(pathname) ?? "outbound";
  const { active: activeSection, select: selectSection } = useOptimisticPill(settledSection);
  const sections = usePillIndicator<HTMLUListElement>(activeSection);

  const settledPage =
    OUTBOUND_PAGES.find((page) => pathname === page.href || pathname.startsWith(`${page.href}/`))?.key ?? "";
  const { active: activePage, select: selectPage } = useOptimisticPill(settledPage);
  const pages = usePillIndicator<HTMLUListElement>(activePage);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <nav aria-label="Versants de la prospection">
        <ul
          ref={sections.listRef}
          className="relative inline-flex items-center gap-1 rounded-pill bg-surface-sunken p-1"
        >
          <PillIndicator box={sections.box} />
          {ANTIDOTES_SECTIONS.map((section) => {
            const current = activeSection === section.key;
            return (
              <li key={section.key} data-pill={section.key} className="relative">
                <Link
                  href={section.href}
                  aria-current={settledSection === section.key ? "page" : undefined}
                  onClick={() => selectSection(section.key)}
                  className={cn(
                    "type-caption focus-visible:ring-ring relative block rounded-pill px-3.5 py-1.5 font-medium transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
                    current
                      ? cn("text-primary-foreground", !sections.measured && "bg-primary")
                      : "text-text-secondary hover:text-text-primary",
                  )}
                >
                  <LinkPending />
                  {section.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {activeSection === "outbound" ? (
        <nav aria-label="Pages de l'outbound" className="border-b border-border">
          <ul ref={pages.listRef} className="relative -mb-px flex items-center gap-1">
            <PillIndicator box={pages.box} variant="underline" />
            {OUTBOUND_PAGES.map((page) => {
              const current = activePage === page.key;
              return (
                <li key={page.key} data-pill={page.key} className="relative">
                  <Link
                    href={page.href}
                    aria-current={settledPage === page.key ? "page" : undefined}
                    onClick={() => selectPage(page.key)}
                    className={cn(
                      "type-label focus-visible:ring-ring relative block px-3 py-2 transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
                      current
                        ? cn("text-text-primary", !pages.measured && "border-b-2 border-text-primary")
                        : "text-text-secondary hover:text-text-primary",
                    )}
                  >
                    <LinkPending />
                    {page.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
