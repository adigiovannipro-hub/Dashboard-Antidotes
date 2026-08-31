"use client";

import { useState } from "react";
import { ChevronRight, Plus, Trash2 } from "lucide-react";

import { createLane, deleteMonth, renameMonth } from "@/app/actions/planning";
import { FeedPreviewButton } from "@/components/planning/feed-preview";
import { PlatformIcon } from "@/components/planning/platform-icon";
import { TextCell, useCellAction } from "@/components/planning/cells";
import { LaneTable } from "@/components/planning/lane-table";
import { MonthWordingMenu } from "@/components/planning/wording-generation";
import type { Scope } from "@/components/planning/subject-row";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ColumnDef } from "@/lib/planning/columns";
import {
  PLATFORM_LABELS,
  PLATFORM_ORDER,
  totalSponsoring,
} from "@/lib/planning/types";
import type { MonthWithLanes, PlanningOwner } from "@/lib/planning/types";
import type { PlanningSort, SortableColumnKey } from "@/lib/ui-preferences";
import { cn } from "@/lib/utils";

/**
 * Un mois du planning — un bloc à part entière, nettement détaché des autres.
 *
 * Replié, il reste une carte qui résume son contenu : nombre de publications
 * et budget de sponsorisation, sans avoir à l'ouvrir.
 */
export function MonthGroup({
  scope,
  month,
  columns,
  owners,
  sort,
  onSort,
  selectedIds,
  onToggleSelect,
  onToggleLane,
  onOpenSubject,
  onEditLabels,
  onPreviewFeed,
  onResizePreview,
  defaultOpen,
  onOpenChange,
  closedLanes,
  onLaneOpenChange,
  forceOpen,
  isOwner,
  workspaceId,
}: {
  scope: Scope;
  month: MonthWithLanes;
  columns: ColumnDef[];
  owners: PlanningOwner[];
  sort: PlanningSort;
  onSort: (column: SortableColumnKey) => void;
  selectedIds: Set<string>;
  onToggleSelect: (subjectId: string) => void;
  onToggleLane: (subjectIds: string[], selected: boolean) => void;
  onOpenSubject: (subjectId: string, focusRetours?: boolean) => void;
  onEditLabels: (column: ColumnDef) => void;
  /** Ouvre la prévisualisation du feed à la fin de ce mois. */
  onPreviewFeed: () => void;
  onResizePreview: (columnId: string, width: number | null) => void;
  defaultOpen: boolean;
  /** Mémorise le pli du mois — le tableau se rouvre comme on l'a laissé. */
  onOpenChange: (open: boolean) => void;
  /** Réseaux repliés, mémorisés eux aussi. */
  closedLanes: string[];
  onLaneOpenChange: (laneId: string, open: boolean) => void;
  /** Une recherche en cours déplie tout : un résultat caché n'existe pas. */
  forceOpen?: boolean;
  /** La génération de wording est un outil d'agence : rien n'en est rendu au client. */
  isOwner: boolean;
  workspaceId: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { run, pending } = useCellAction();
  const effectiveOpen = forceOpen || open;

  const toggle = (next: boolean) => {
    setOpen(next);
    onOpenChange(next);
  };

  const subjects = month.lanes.flatMap((lane) => lane.subjects);
  const live = subjects.filter((subject) => subject.status !== "dropped");
  const sponsoring = totalSponsoring(subjects);
  const usedPlatforms = new Set(month.lanes.map((lane) => lane.platform));

  return (
    <section
      aria-label={month.label}
      className={cn(
        "border-border-strong overflow-hidden rounded-xl border transition-shadow",
        // Le mois ouvert est celui qu'on travaille : il se détache du fond.
        effectiveOpen && "shadow-card",
      )}
      // Le rail gauche est la colonne vertébrale de l'année : à l'encre pour le
      // mois ouvert, au vert de marque pour les mois qui portent du travail,
      // effacé pour les mois vides. On repère d'un coup d'œil où il y a
      // quelque chose sans lire douze libellés identiques.
      style={{
        borderLeftWidth: 4,
        borderLeftColor: effectiveOpen
          ? "var(--accent-ink)"
          : live.length > 0
            ? "var(--accent)"
            : "var(--border-line)",
      }}
    >
      <header
        className={cn(
          "group/mois flex items-center gap-2.5 px-3 transition-colors",
          // Un mois ouvert prend de la hauteur ; replié, il reste un rang.
          effectiveOpen ? "bg-surface-sunken py-3" : "py-2 hover:bg-surface-sunken/60",
        )}
        // Survoler un mois replié avec une ligne en main l'ouvre : on peut
        // déposer dans n'importe quel mois sans lâcher.
        onDragOver={(event) => {
          if (![...event.dataTransfer.types].includes("text/x-antidotes-subject")) {
            return;
          }
          event.preventDefault();
          if (!open) toggle(true);
        }}
      >
        <button
          type="button"
          onClick={() => toggle(!open)}
          aria-expanded={effectiveOpen}
          aria-label={effectiveOpen ? `Replier ${month.label}` : `Déplier ${month.label}`}
          className="hover:bg-muted focus-visible:ring-ring rounded p-0.5 focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronRight
            className={cn("size-4 transition-transform", effectiveOpen && "rotate-90")}
            aria-hidden
          />
        </button>

        <div className="w-44">
          <TextCell
            value={month.label}
            ariaLabel="Nom du mois"
            className={cn(
              "font-bold tracking-wider uppercase",
              // Le mois ouvert domine la page ; les autres restent lisibles
              // sans réclamer l'attention. Un mois vide passe à l'encre
              // secondaire : parcourue de haut en bas, l'année ne présente
              // alors que les mois qui portent quelque chose.
              effectiveOpen ? "text-base" : "text-sm",
              live.length > 0 ? "text-text-primary" : "text-text-secondary",
            )}
            onCommit={(next) =>
              run(() => renameMonth(scope, { monthId: month.id, label: next }))
            }
          />
        </div>

        {/* Le compte en pastille verte, les réseaux en pastilles de marque :
            un mois replié dit combien de publications et sur quoi, sans
            l'ouvrir — « 3 · publications · 1 réseau » demandait de lire pour
            apprendre moins. Un mois vide n'a pas de chiffre à mettre en
            avant : il le dit d'un mot et s'efface. */}
        {live.length > 0 ? (
          <span className="flex min-w-0 items-center gap-2">
            <span className="bg-accent-subtle text-accent-ink rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums">
              {live.length}
            </span>

            {month.lanes.length > 0 ? (
              <span className="flex items-center gap-1">
                {month.lanes.map((lane) => (
                  <PlatformIcon key={lane.id} platform={lane.platform} />
                ))}
              </span>
            ) : null}

            {sponsoring > 0 ? (
              <span className="text-text-secondary type-caption tabular-nums">
                {new Intl.NumberFormat("fr-FR", {
                  style: "currency",
                  currency: "EUR",
                  maximumFractionDigits: 0,
                }).format(sponsoring)}{" "}
                de sponso
              </span>
            ) : null}
          </span>
        ) : (
          // Un mois sans le moindre couloir n'a rien à dire : son titre en
          // encre secondaire et son rail effacé le disent déjà, et sept
          // « Mois vide » alignés faisaient sept fois du bruit. Un mois qui
          // porte des couloirs mais aucune publication, lui, mérite le mot.
          month.lanes.length > 0 ? (
            <span className="text-text-secondary type-caption">
              Aucune publication
            </span>
          ) : null
        )}

        <div className="ml-auto flex items-center gap-1">
          {isOwner ? (
            <MonthWordingMenu
              workspaceId={workspaceId}
              targetMonth={month.month}
              monthLabel={month.label}
            />
          ) : null}
          <FeedPreviewButton onClick={onPreviewFeed} />

          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={pending}
              className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <Plus className="size-3.5" aria-hidden />
              Réseau
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 min-w-44">
              {PLATFORM_ORDER.map((platform) => (
                <DropdownMenuItem
                  key={platform}
                  onClick={() =>
                    run(() =>
                      createLane(scope, {
                        monthId: month.id,
                        boardId: month.board_id,
                        platform,
                      }),
                    )
                  }
                >
                  {PLATFORM_LABELS[platform]}
                  {usedPlatforms.has(platform) ? (
                    <span className="text-muted-foreground ml-auto text-[10px]">
                      déjà présent
                    </span>
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            onClick={() => run(() => deleteMonth(scope, { monthId: month.id }))}
            aria-label={`Supprimer le mois ${month.label}`}
            className="text-muted-foreground hover:text-danger-ink focus-visible:ring-ring rounded p-1 focus-visible:ring-2 focus-visible:outline-none"
          >
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        </div>
      </header>

      {effectiveOpen ? (
        <div className="border-border-strong bg-canvas space-y-3 border-t p-3">
          {month.lanes.length === 0 ? (
            <p className="type-caption rounded-md border border-dashed border-border px-3 py-4 text-center text-text-secondary">
              Aucun réseau pour ce mois. Ajoutez-en un pour commencer à poser des
              publications.
            </p>
          ) : (
            month.lanes.map((lane) => (
              <LaneTable
                key={lane.id}
                scope={scope}
                lane={lane}
                columns={columns}
                owners={owners}
                sort={sort}
                onSort={onSort}
                selectedIds={selectedIds}
                onToggleSelect={onToggleSelect}
                onToggleLane={onToggleLane}
                onOpenSubject={onOpenSubject}
                onEditLabels={onEditLabels}
                onResizePreview={onResizePreview}
                defaultOpen={!closedLanes.includes(lane.id)}
                onOpenChange={(next) => onLaneOpenChange(lane.id, next)}
                canGenerateWording={isOwner}
              />
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}
