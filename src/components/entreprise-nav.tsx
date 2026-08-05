"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Rail de la section « Mon entreprise ». Composant client pour une seule
 * raison : savoir quelle entrée est active. Tant que la section n'avait qu'une
 * entrée, un `aria-current` codé en dur suffisait — plus maintenant.
 */

const ITEMS = [
  { href: "/entreprise/finance", label: "Finance" },
  { href: "/entreprise/recus", label: "Reçus" },
];

export function EntrepriseNav() {
  const pathname = usePathname();

  return (
    <ul className="flex gap-1 md:flex-col">
      {ITEMS.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "bg-muted text-foreground focus-visible:ring-ring block rounded-md px-3 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60 focus-visible:ring-ring block rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
              }
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
