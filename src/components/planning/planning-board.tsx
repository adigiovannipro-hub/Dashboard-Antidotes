"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Info, Plus } from "lucide-react";

import { createMonth } from "@/app/actions/planning";
import { StatusPill } from "@/components/ds/status-pill";
import { Panel, PanelHeader } from "@/components/ds/surface";
import { useCellAction } from "@/components/planning/cells";
import { MonthGroup } from "@/components/planning/month-group";
import type { Scope } from "@/components/planning/subject-row";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CadenceIssue } from "@/lib/planning/cadence";
import { monthGroupLabel } from "@/lib/planning/monday-mapping";
import type {
  MonthWithLanes,
  PlanningBoard,
  PlanningOwner,
} from "@/lib/planning/types";
import { cn } from "@/lib/utils";

/**
 * Le tableau d'une année.
 *
 * La structure reprend celle du board Monday d'origine — mois, puis réseau,
 * puis publication — parce que c'est celle dans laquelle l'équipe pense déjà.
 * Ce que le dashboard ajoute tient en une ligne repliée en haut : le contrôle
 * de cadence, que Monday ne sait pas faire.
 */
export function PlanningBoardView({
  scope,
  boards,
  board,
  months,
  owners,
  issues,
  currentMonthKey,
  workspaceSlug,
}: {
  scope: Scope;
  boards: PlanningBoard[];
  board: PlanningBoard;
  months: MonthWithLanes[];
  owners: PlanningOwner[];
  issues: CadenceIssue[];
  currentMonthKey: string;
  workspaceSlug: string;
}) {
  const { run, pending } = useCellAction();

  const present = new Set(months.map((month) => month.month));
  const year = board.year ?? new Date().getUTCFullYear();
  const missing = Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}-01`;
    return present.has(month) ? null : month;
  }).filter((month): month is string => month !== null);

  const flagged = new Set(
    issues.flatMap((issue) =>
      issue.code === "volume_off_target" ? [] : issue.subjectIds,
    ),
  );

  // Le compteur de l'année : ce qui est encore en jeu, non retenu exclu.
  const publicationCount = months.reduce(
    (sum, month) =>
      sum +
      month.lanes.reduce(
        (laneSum, lane) =>
          laneSum +
          lane.subjects.filter((subject) => subject.status !== "dropped").length,
        0,
      ),
    0,
  );

  // Le cadre de l'application fournit déjà la marge de page : en ajouter une
  // ici décalait le planning de tous les autres écrans.
  return (
    <div className="min-w-0 flex-1 space-y-4">
      <BoardTabs boards={boards} current={board} workspaceSlug={workspaceSlug} />

      <CadenceStrip issues={issues} />

      {months.length === 0 ? (
        <p className="type-body rounded-lg border border-dashed border-border p-10 text-center text-text-secondary">
          Ce tableau est vide. Ajoutez un mois pour commencer.
        </p>
      ) : (
        /* Un seul panneau pour l'année, un rang par mois. Douze cartes
           flottantes donnaient le même poids visuel aux onze mois vides qu'au
           seul mois qu'on vient regarder. */
        <Panel>
          <PanelHeader
            title={board.name}
            count={publicationCount}
            description="Le mois en cours est ouvert ; les autres se déplient d'un clic."
          />
          {months.map((month) => (
            <MonthGroup
              key={month.id}
              scope={scope}
              month={month}
              owners={owners}
              objectives={board.settings.ad_objectives}
              flagged={flagged}
              // Le mois en cours est ouvert, les autres repliés : c'est celui
              // qu'on vient regarder neuf fois sur dix.
              defaultOpen={month.month === currentMonthKey}
            />
          ))}
        </Panel>
      )}

      {missing.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={pending}
            className="text-muted-foreground hover:text-foreground border-border hover:bg-muted/40 focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <Plus className="size-3.5" aria-hidden />
            Ajouter un mois
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-44 min-w-44">
            {missing.map((month) => (
              <DropdownMenuItem
                key={month}
                onClick={() => run(() => createMonth(scope, { boardId: board.id, month }))}
              >
                {monthGroupLabel(month)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

export function BoardTabs({
  boards,
  current,
  workspaceSlug,
}: {
  boards: PlanningBoard[];
  current: PlanningBoard;
  workspaceSlug: string;
}) {
  // Volontairement plus léger que les onglets de section, juste au-dessus :
  // deux rangées de pastilles identiques donneraient le même poids à deux
  // niveaux de navigation différents. Ici, un simple soulignement.
  return (
    <nav aria-label="Tableaux">
      <ul className="flex items-center gap-4 border-b border-border">
        {boards.map((board) => {
          const active = board.id === current.id;
          return (
            <li key={board.id}>
              <Link
                href={`/espace/${workspaceSlug}/planning/${board.slug}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "type-label focus-visible:ring-ring -mb-px block border-b-2 px-0.5 pb-2.5 transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
                  active
                    ? "border-text-primary text-text-primary"
                    : "border-transparent text-text-secondary hover:text-text-primary",
                )}
              >
                {board.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Le contrôle de cadence, en une ligne dépliable.
 *
 * Volontairement discret : c'est un avis, pas une interdiction. Un Reel le
 * dimanche parce que c'est le jour du Grand Prix est un bon choix.
 */
function CadenceStrip({ issues }: { issues: CadenceIssue[] }) {
  const [open, setOpen] = useState(false);
  const warnings = issues.filter((issue) => issue.severity === "warning").length;

  if (issues.length === 0) {
    return (
      <Panel className="flex items-center gap-2 px-4 py-3">
        <StatusPill tone="positive">Cadence</StatusPill>
        <p className="type-caption text-text-secondary">
          Rien à signaler sur le mois en cours.
        </p>
      </Panel>
    );
  }

  return (
    <Panel>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="hover:bg-muted/40 focus-visible:ring-ring flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none"
      >
        <ChevronRight
          className={cn(
            "size-4 shrink-0 text-text-secondary transition-transform",
            open && "rotate-90",
          )}
          aria-hidden
        />
        <span className="type-label text-text-primary">Contrôle de cadence</span>
        <StatusPill tone={warnings > 0 ? "warning" : "info"}>
          {warnings > 0
            ? `${warnings} point${warnings > 1 ? "s" : ""} à regarder`
            : `${issues.length} remarque${issues.length > 1 ? "s" : ""}`}
        </StatusPill>
      </button>

      {open ? (
        <ul className="space-y-2 border-t border-border px-4 py-3">
          {issues.map((issue, index) => (
            <li
              key={`${issue.code}-${index}`}
              className="type-caption flex items-start gap-2"
            >
              {issue.severity === "warning" ? (
                <AlertTriangle
                  className="mt-0.5 size-3.5 shrink-0 text-warning-ink"
                  aria-label="Avertissement"
                />
              ) : (
                <Info
                  className="mt-0.5 size-3.5 shrink-0 text-text-tertiary"
                  aria-label="Information"
                />
              )}
              <span
                className={
                  issue.severity === "warning"
                    ? "text-text-primary"
                    : "text-text-secondary"
                }
              >
                {issue.message}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}
