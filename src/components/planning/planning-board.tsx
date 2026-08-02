"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Info, Plus } from "lucide-react";

import { createMonth } from "@/app/actions/planning";
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

  return (
    <div className="min-w-0 flex-1 p-4 md:p-6">
      <BoardTabs boards={boards} current={board} workspaceSlug={workspaceSlug} />

      <CadenceStrip issues={issues} />

      {months.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-lg border border-dashed p-10 text-center text-sm">
          Ce tableau est vide. Ajoutez un mois pour commencer.
        </p>
      ) : (
        months.map((month) => (
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
        ))
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
  return (
    <nav aria-label="Tableaux" className="mb-4 flex items-center gap-1">
      {boards.map((board) => (
        <Link
          key={board.id}
          href={`/espace/${workspaceSlug}/planning/${board.slug}`}
          aria-current={board.id === current.id ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm transition-colors",
            board.id === current.id
              ? "bg-card text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {board.name}
        </Link>
      ))}
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
      <p className="text-muted-foreground mb-4 text-xs">
        Contrôle de cadence : rien à signaler sur le mois en cours.
      </p>
    );
  }

  return (
    <div className="border-border mb-4 rounded-md border">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="hover:bg-muted/40 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition-colors"
      >
        <ChevronRight
          className={cn("size-3.5 transition-transform", open && "rotate-90")}
          aria-hidden
        />
        <span className="font-medium">Contrôle de cadence</span>
        <span className="text-muted-foreground">
          {warnings > 0
            ? `${warnings} point${warnings > 1 ? "s" : ""} à regarder`
            : `${issues.length} remarque${issues.length > 1 ? "s" : ""}`}
        </span>
      </button>

      {open ? (
        <ul className="space-y-1 px-3 pt-1 pb-3">
          {issues.map((issue, index) => (
            <li
              key={`${issue.code}-${index}`}
              className="flex items-start gap-1.5 text-xs"
            >
              {issue.severity === "warning" ? (
                <AlertTriangle
                  className="text-brand-red mt-0.5 size-3 shrink-0"
                  aria-label="Avertissement"
                />
              ) : (
                <Info
                  className="text-muted-foreground mt-0.5 size-3 shrink-0"
                  aria-label="Information"
                />
              )}
              <span
                className={
                  issue.severity === "warning"
                    ? "text-foreground"
                    : "text-muted-foreground"
                }
              >
                {issue.message}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
