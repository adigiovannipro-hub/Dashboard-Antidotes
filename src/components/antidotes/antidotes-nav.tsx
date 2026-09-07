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
  ANTIDOTES_GROUP_LABELS,
  ANTIDOTES_PAGES,
  type AntidotesGroup,
} from "@/lib/antidotes/navigation";
import { cn } from "@/lib/utils";

/**
 * Les onglets du pôle Antidotes — deux niveaux dans une seule rangée.
 *
 * Le pôle a deux versants, outbound et inbound, et chacun ses pages. Plutôt
 * que deux rangées de pastilles identiques — qui mentiraient sur la
 * hiérarchie —, chaque versant est un **groupe** : son nom en surtitre, ses
 * pages en pastilles dans la même gouttière creuse que les sections d'un
 * espace client. L'aplat actif glisse d'un onglet à l'autre et part au clic,
 * comme `DashboardNav`.
 *
 * La liste vient de `lib/antidotes/navigation.ts`, la même que le sous-menu
 * du rail : un onglet n'existe ici que si sa page existe.
 */
export function AntidotesNav() {
  const pathname = usePathname();
  const settled =
    ANTIDOTES_PAGES.find(
      (page) => pathname === page.href || pathname.startsWith(`${page.href}/`),
    )?.key ?? "";
  const { active, select } = useOptimisticPill(settled);
  const { listRef, box, measured } = usePillIndicator<HTMLUListElement>(active);

  const groups = (["outbound", "inbound", "root"] as AntidotesGroup[])
    .map((group) => ({
      group,
      pages: ANTIDOTES_PAGES.filter((page) => page.group === group),
    }))
    .filter((entry) => entry.pages.length > 0);

  return (
    <nav aria-label="Sections d'Antidotes" className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {/* Une seule liste mesurée pour tous les groupes : l'aplat doit pouvoir
          glisser d'un versant à l'autre, pas seulement à l'intérieur d'un. */}
      <ul
        ref={listRef}
        className="relative inline-flex flex-wrap items-center gap-1 rounded-pill bg-surface-sunken p-1"
      >
        <PillIndicator box={box} />
        {groups.map(({ group, pages }, index) => (
          <li key={group} className="contents">
            {ANTIDOTES_GROUP_LABELS[group] ? (
              <span
                aria-hidden
                className={cn(
                  "type-overline relative px-2.5 text-text-secondary",
                  index > 0 && "border-l border-border-strong",
                )}
              >
                {ANTIDOTES_GROUP_LABELS[group]}
              </span>
            ) : null}
            {pages.map((page) => {
              const current = active === page.key;
              return (
                <span key={page.key} data-pill={page.key} className="relative">
                  <Link
                    href={page.href}
                    aria-current={settled === page.key ? "page" : undefined}
                    onClick={() => select(page.key)}
                    className={cn(
                      "type-caption focus-visible:ring-ring relative block rounded-pill px-3.5 py-1.5 font-medium transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
                      current
                        ? cn("text-primary-foreground", !measured && "bg-primary")
                        : "text-text-secondary hover:text-text-primary",
                    )}
                  >
                    <LinkPending />
                    {page.name}
                  </Link>
                </span>
              );
            })}
          </li>
        ))}
      </ul>
    </nav>
  );
}
