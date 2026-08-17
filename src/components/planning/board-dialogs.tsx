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

// --- Archives et corbeille ----------------------------------------------------

/**
 * Une seule boîte pour tout ce qui a quitté le tableau : l'archivé et le
 * supprimé, chacun sous son intitulé, tous restaurables d'un clic. Deux
 * icônes d'en-tête pour deux listes de retour se confondaient — et l'icône
 * corbeille sert désormais à supprimer l'année.
 */
export function ArchiveDialog({
  scope,
  archived,
  trashSubjects,
  trashMonths,
  open,
  onOpenChange,
}: {
  scope: Scope;
  archived: SubjectRow[];
  trashSubjects: SubjectRow[];
  trashMonths: PlanningMonth[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { run, pending } = useCellAction();
  const total = archived.length + trashSubjects.length + trashMonths.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Archives et corbeille — {total}</DialogTitle>
        </DialogHeader>

        {total === 0 ? (
          <p className="text-muted-foreground text-sm">
            Rien ici. « Archiver » et « Supprimer » vivent dans la barre de
            sélection, en bas de l&apos;écran — tout ce qui y passe se
            retrouve dans cette boîte, restaurable d&apos;un clic.
          </p>
        ) : (
          <div className="max-h-96 space-y-4 overflow-y-auto">
            {archived.length > 0 ? (
              <section>
                <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold tracking-wide uppercase">
                  Archivées — {archived.length}
                </p>
                <ul className="space-y-1.5">
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
              </section>
            ) : null}

            {trashSubjects.length + trashMonths.length > 0 ? (
              <section>
                <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold tracking-wide uppercase">
                  Corbeille — {trashSubjects.length + trashMonths.length}
                </p>
                <ul className="space-y-1.5">
                  {trashMonths.map((month) => (
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
                  {trashSubjects.map((subject) => (
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
              </section>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// --- Supprimer l'année ---------------------------------------------------------

/**
 * La suppression du tableau entier — l'année et tout ce qu'elle contient.
 *
 * Pas de corbeille pour un tableau : c'est une décision d'owner, rare et
 * définitive, dite en toutes lettres avant le clic. La RLS ne l'accorde de
 * toute façon qu'au propriétaire.
 */
export function DeleteBoardDialog({
  scope,
  boardName,
  monthCount,
  open,
  onOpenChange,
  onDelete,
}: {
  scope: Scope;
  boardName: string;
  monthCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Supprimer l&apos;année {boardName}</DialogTitle>
        </DialogHeader>

        <p className="text-muted-foreground text-sm">
          Le tableau {boardName} de l&apos;espace {scope.workspace} partira
          définitivement — ses {monthCount} mois, toutes leurs publications,
          les visuels accrochés et le journal. Cette suppression ne passe pas
          par la corbeille : rien ne se restaure.
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              try {
                await onDelete();
              } finally {
                setPending(false);
              }
            }}
          >
            Supprimer l&apos;année et le tableau
          </Button>
        </div>
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
