"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Panel, PanelHeader, PanelRows } from "@/components/ds/surface";
import { StatusPill } from "@/components/ds/status-pill";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatDayFr } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * L'historique des versions, en bas de page.
 *
 * Il occupait un sélecteur dans l'en-tête, à côté du titre : la première
 * chose lue sur la page était un numéro de version, alors qu'on vient y lire
 * un brief. L'accessoire descend, comme partout ailleurs dans l'application.
 */
export function VersionHistory({
  versions,
  activeVersion,
  viewedVersion,
  restorePending,
  onRestore,
}: {
  versions: { id: string; version: number; is_active: boolean; created_at: string }[];
  activeVersion: number | null;
  /** Version actuellement consultée en lecture seule, s'il y en a une. */
  viewedVersion: number | null;
  restorePending: boolean;
  onRestore: (version: number) => void;
}) {
  const pathname = usePathname();
  if (versions.length === 0) return null;

  return (
    <Panel>
      <PanelHeader
        title="Historique des versions"
        count={versions.length}
        description="Chaque régénération et chaque restauration crée une version. Une version passée reste consultable, rien n'est jamais écrasé."
      />
      <PanelRows>
        {versions.map((entry) => {
          const consulted = entry.version === viewedVersion;
          return (
            <div
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
            >
              <div className="min-w-0">
                <p className="type-label text-text-primary">Version {entry.version}</p>
                <p className="type-caption text-text-secondary">
                  créée le {formatDayFr(entry.created_at.slice(0, 10))}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {entry.is_active ? (
                  <StatusPill tone="positive">Active</StatusPill>
                ) : consulted ? (
                  <StatusPill tone="info">Consultée</StatusPill>
                ) : null}

                {!entry.is_active && !consulted ? (
                  <Link
                    href={`${pathname}?version=${entry.version}`}
                    className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                  >
                    Consulter
                  </Link>
                ) : null}

                {entry.version !== activeVersion ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={restorePending}
                    onClick={() => onRestore(entry.version)}
                  >
                    Restaurer
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </PanelRows>
    </Panel>
  );
}
