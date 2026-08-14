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
  REPORTING_NETWORK_LABELS,
  type ReportingNetwork,
} from "@/lib/reporting/networks";
import { cn } from "@/lib/utils";

/**
 * Les onglets de réseau du Reporting.
 *
 * Même langage que les tableaux du Planning, un cran sous les onglets de
 * section : un soulignement qui glisse, jamais une seconde rangée de
 * pastilles — deux rangées identiques donneraient le même poids à deux
 * niveaux de navigation différents.
 *
 * Le réseau voyage en **paramètre d'URL** et non en segment de chemin : c'est
 * une vue du même tableau de bord, elle se partage par copie du lien et
 * survit au retour arrière sans qu'on ait à ouvrir une route par réseau.
 */
export function ReportingTabs({
  networks,
  current,
}: {
  networks: readonly ReportingNetwork[];
  current: ReportingNetwork;
}) {
  const pathname = usePathname();
  const { active, select } = useOptimisticPill(current);
  const { listRef, box, measured } = usePillIndicator<HTMLUListElement>(active);

  if (networks.length < 2) return null;

  return (
    <nav aria-label="Réseaux">
      <ul
        ref={listRef}
        className="border-border relative flex items-center gap-4 border-b"
      >
        <PillIndicator box={box} variant="underline" />

        {networks.map((network) => {
          const isActive = active === network;
          return (
            <li key={network} data-pill={network}>
              <Link
                href={`${pathname}?reseau=${network}`}
                aria-current={network === current ? "page" : undefined}
                onClick={() => select(network)}
                className={cn(
                  "type-label focus-visible:ring-ring relative -mb-px block border-b-2 px-0.5 pb-2.5 transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
                  isActive
                    ? cn(
                        "text-text-primary",
                        measured ? "border-transparent" : "border-text-primary",
                      )
                    : "border-transparent text-text-secondary hover:text-text-primary",
                )}
              >
                <LinkPending />
                {REPORTING_NETWORK_LABELS[network]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
