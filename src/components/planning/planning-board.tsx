"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";

import { createMonth } from "@/app/actions/planning";
import { BulkBar } from "@/components/planning/bulk-bar";
import { useCellAction } from "@/components/planning/cells";
import { MonthGroup } from "@/components/planning/month-group";
import { SubjectDrawer } from "@/components/planning/subject-drawer";
import type { DateSort } from "@/components/planning/lane-table";
import type { Scope } from "@/components/planning/subject-row";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ColumnDef } from "@/lib/planning/columns";
import { applyWidths } from "@/lib/planning/columns";
import { monthGroupLabel } from "@/lib/planning/monday-mapping";
import type {
  MonthWithLanes,
  PlanningActivity,
  PlanningBoard,
  PlanningOwner,
  SubjectRow,
} from "@/lib/planning/types";
import { cn } from "@/lib/utils";

/**
 * Le tableau d'une année.
 *
 * Trois états d'écran vivent ici et nulle part ailleurs : la sélection
 * multiple (la barre du bas), le tri de la colonne Date, et la publication
 * ouverte — celle-ci dans l'URL, pour qu'un lien partagé rouvre le même
 * panneau.
 */
export function PlanningBoardView({
  scope,
  boards,
  board,
  months,
  columns,
  owners,
  drawer,
  currentMonthKey,
  workspaceSlug,
}: {
  scope: Scope;
  boards: PlanningBoard[];
  board: PlanningBoard;
  months: MonthWithLanes[];
  columns: ColumnDef[];
  owners: PlanningOwner[];
  /** La publication ouverte et son journal, résolus côté serveur. */
  drawer: { subject: SubjectRow; activity: PlanningActivity[] } | null;
  currentMonthKey: string;
  workspaceSlug: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { run, pending } = useCellAction();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<DateSort>("position");
  // Largeurs en cours de drag : le tableau suit le pointeur sans attendre la
  // base, qui reçoit la valeur finale au relâchement.
  const [widthPreview, setWidthPreview] = useState<Record<string, number>>({});
  const effectiveColumns = applyWidths(columns, widthPreview);

  const openSubject = useCallback(
    (subjectId: string) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set("sujet", subjectId);
      router.push(`${pathname}?${next}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const closeDrawer = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("sujet");
    router.push(`${pathname}?${next}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const toggleSelect = useCallback((subjectId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(subjectId)) next.delete(subjectId);
      else next.add(subjectId);
      return next;
    });
  }, []);

  const toggleLane = useCallback((subjectIds: string[], selected: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of subjectIds) {
        if (selected) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const present = new Set(months.map((month) => month.month));
  const year = board.year ?? new Date().getUTCFullYear();
  const missing = Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}-01`;
    return present.has(month) ? null : month;
  }).filter((month): month is string => month !== null);

  // Le cadre de l'application fournit déjà la marge de page : en ajouter une
  // ici décalait le planning de tous les autres écrans.
  return (
    <div className="min-w-0 flex-1 space-y-4">
      <BoardTabs boards={boards} current={board} workspaceSlug={workspaceSlug} />

      {months.length === 0 ? (
        <p className="type-body rounded-lg border border-dashed border-border p-10 text-center text-text-secondary">
          Ce tableau est vide. Ajoutez un mois pour commencer.
        </p>
      ) : (
        // Chaque mois est un bloc à part entière : l'année se lit comme une
        // pile de cartes, pas comme une liste continue.
        <div className="space-y-4">
          {months.map((month) => (
            <MonthGroup
              key={month.id}
              scope={scope}
              month={month}
              columns={effectiveColumns}
              owners={owners}
              sort={sort}
              onSortToggle={() =>
                setSort((current) => (current === "asc" ? "desc" : "asc"))
              }
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleLane={toggleLane}
              onOpenSubject={openSubject}
              onResizePreview={(columnId, width) =>
                setWidthPreview((current) =>
                  width === null
                    ? Object.fromEntries(
                        Object.entries(current).filter(([id]) => id !== columnId),
                      )
                    : { ...current, [columnId]: width },
                )
              }
              // Le mois en cours est ouvert, les autres repliés : c'est celui
              // qu'on vient regarder neuf fois sur dix.
              defaultOpen={month.month === currentMonthKey}
            />
          ))}
        </div>
      )}

      {missing.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={pending}
            className="type-caption focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-text-secondary transition-colors hover:bg-muted/40 hover:text-text-primary focus-visible:ring-2 focus-visible:outline-none"
          >
            <Plus className="size-3.5" aria-hidden />
            Ajouter un mois
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-44 min-w-44">
            {missing.map((month) => (
              <DropdownMenuItem
                key={month}
                onClick={() =>
                  run(() => createMonth(scope, { boardId: board.id, month }))
                }
              >
                {monthGroupLabel(month)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <BulkBar
        scope={scope}
        selectedIds={selectedIds}
        columns={effectiveColumns}
        owners={owners}
        onClear={() => setSelectedIds(new Set())}
      />

      {drawer ? (
        <SubjectDrawer
          key={drawer.subject.id}
          scope={scope}
          subject={drawer.subject}
          columns={effectiveColumns}
          activity={drawer.activity}
          onClose={closeDrawer}
        />
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
                {/* La navigation dit déjà « Planning Éditorial » : répéter le
                    nom complet ferait doublon, l'année suffit à distinguer les
                    tableaux. */}
                {board.year ? String(board.year) : board.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
