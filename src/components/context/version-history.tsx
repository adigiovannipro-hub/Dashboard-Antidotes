"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusPill } from "@/components/ds/status-pill";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatDayFr } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * L'historique des versions, derrière un lien discret en pied de page.
 *
 * Il a d'abord occupé un sélecteur dans l'en-tête — la première chose lue sur
 * la page était un numéro de version, alors qu'on vient y lire un brief —
 * puis un panneau en bas. Un panneau reste un bloc à faire défiler pour un
 * geste qu'on fait deux fois par an : il devient une modale, et le lien qui
 * l'ouvre tient sur une ligne.
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
  const [open, setOpen] = useState(false);
  if (versions.length === 0) return null;

  return (
    <>
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="focus-visible:ring-ring rounded-md px-2 py-1 type-caption text-text-secondary underline underline-offset-2 hover:text-text-primary focus-visible:ring-2 focus-visible:outline-none"
        >
          Historique des versions ({versions.length})
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] w-full overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Historique des versions</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col">
            {versions.map((entry) => {
              const consulted = entry.version === viewedVersion;
              return (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3 last:border-b-0"
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
                        onClick={() => setOpen(false)}
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
                        onClick={() => {
                          setOpen(false);
                          onRestore(entry.version);
                        }}
                      >
                        Restaurer
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
