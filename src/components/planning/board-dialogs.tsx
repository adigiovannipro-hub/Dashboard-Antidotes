"use client";

import { useState } from "react";
import { ArchiveRestore, Search, Undo2 } from "lucide-react";

import {
  restoreMonth,
  restoreSubjects,
} from "@/app/actions/planning";
import { useCellAction } from "@/components/planning/cells";
import { PlatformIcon } from "@/components/planning/platform-icon";
import type { Scope } from "@/components/planning/subject-row";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { monthGroupLabel } from "@/lib/planning/monday-mapping";
import type {
  MonthWithLanes,
  PlanningMonth,
  SubjectRow,
} from "@/lib/planning/types";

/**
 * Les boîtes de l'en-tête et de la barre groupée : déplacer une sélection
 * vers un autre parent, rouvrir les archives, fouiller la corbeille.
 */

// --- Choisir un nouveau parent ----------------------------------------------

/**
 * Le « Choisir un nouveau parent » de Monday : tous les réseaux du tableau,
 * groupés par mois, filtrés au clavier. Le clic déplace la sélection en fin
 * du couloir choisi.
 */
export function MoveDialog({
  months,
  open,
  onOpenChange,
  onPick,
}: {
  months: MonthWithLanes[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (laneId: string) => void;
}) {
  const [query, setQuery] = useState("");

  const fold = (value: string) =>
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  const needle = fold(query.trim());

  const groups = months
    .map((month) => ({
      month,
      lanes: month.lanes.filter(
        (lane) =>
          !needle ||
          fold(lane.name).includes(needle) ||
          fold(month.label).includes(needle),
      ),
    }))
    .filter((group) => group.lanes.length > 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next) setQuery("");
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Choisir un nouveau parent</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
            aria-hidden
          />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Rechercher un réseau"
            placeholder="Rechercher"
            className="pl-8"
          />
        </div>

        <div className="max-h-80 space-y-3 overflow-y-auto">
          {groups.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucun réseau ne répond.</p>
          ) : (
            groups.map(({ month, lanes }) => (
              <div key={month.id}>
                <p className="text-muted-foreground mb-1 text-[11px] font-semibold tracking-wide uppercase">
                  {month.label}
                </p>
                <ul className="space-y-1">
                  {lanes.map((lane) => (
                    <li key={lane.id}>
                      <button
                        type="button"
                        onClick={() => onPick(lane.id)}
                        className="border-border hover:bg-muted/60 focus-visible:ring-brand flex w-full items-center gap-2 overflow-hidden rounded-md border text-left text-sm focus-visible:ring-2 focus-visible:outline-none"
                      >
                        {/* La barre de repère du parent, comme sur Monday. */}
                        <span aria-hidden className="bg-accent-ink h-9 w-1 shrink-0" />
                        <PlatformIcon platform={lane.platform} />
                        <span className="truncate py-2">{lane.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Archives ----------------------------------------------------------------

export function ArchiveDialog({
  scope,
  archived,
  open,
  onOpenChange,
}: {
  scope: Scope;
  archived: SubjectRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { run, pending } = useCellAction();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Archives — {archived.length}</DialogTitle>
        </DialogHeader>

        {archived.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Rien d&apos;archivé. « Archiver » vit dans la barre de sélection, en
            bas de l&apos;écran.
          </p>
        ) : (
          <ul className="max-h-96 space-y-1.5 overflow-y-auto">
            {archived.map((subject) => (
              <RestorableRow
                key={subject.id}
                title={subject.name || "Sans sujet"}
                detail={`${subject.lane_name} · ${monthGroupLabel(subject.month_key)}`}
                pending={pending}
                icon={<ArchiveRestore className="size-3.5" aria-hidden />}
                onRestore={() =>
                  run(() => restoreSubjects(scope, { subjectIds: [subject.id] }))
                }
              />
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

// --- Corbeille ---------------------------------------------------------------

export function TrashDialog({
  scope,
  subjects,
  months,
  open,
  onOpenChange,
}: {
  scope: Scope;
  subjects: SubjectRow[];
  months: PlanningMonth[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { run, pending } = useCellAction();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Corbeille — {subjects.length + months.length}</DialogTitle>
        </DialogHeader>

        {subjects.length === 0 && months.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            La corbeille est vide. Ce qui se supprime arrive ici, et se
            restaure d&apos;un clic.
          </p>
        ) : (
          <ul className="max-h-96 space-y-1.5 overflow-y-auto">
            {months.map((month) => (
              <RestorableRow
                key={month.id}
                title={`Mois ${month.label}`}
                detail="avec toutes ses publications"
                pending={pending}
                icon={<Undo2 className="size-3.5" aria-hidden />}
                onRestore={() =>
                  run(() => restoreMonth(scope, { monthId: month.id }))
                }
              />
            ))}
            {subjects.map((subject) => (
              <RestorableRow
                key={subject.id}
                title={subject.name || "Sans sujet"}
                detail={`${subject.lane_name} · ${monthGroupLabel(subject.month_key)}`}
                pending={pending}
                icon={<Undo2 className="size-3.5" aria-hidden />}
                onRestore={() =>
                  run(() => restoreSubjects(scope, { subjectIds: [subject.id] }))
                }
              />
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RestorableRow({
  title,
  detail,
  icon,
  pending,
  onRestore,
}: {
  title: string;
  detail: string;
  icon: React.ReactNode;
  pending: boolean;
  onRestore: () => void;
}) {
  return (
    <li className="border-border/60 flex items-center gap-3 rounded-md border px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="text-muted-foreground truncate text-xs">{detail}</p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={onRestore}
      >
        {icon}
        Restaurer
      </Button>
    </li>
  );
}
