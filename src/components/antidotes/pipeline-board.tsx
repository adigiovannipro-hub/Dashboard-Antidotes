"use client";

import { useOptimistic, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { moveProspects } from "@/app/actions/antidotes";
import { NewProspectFormDialog } from "@/components/antidotes/new-prospect-dialog";
import { StatusDot } from "@/components/antidotes/pipeline-chips";
import { ProspectCard } from "@/components/antidotes/prospect-card";
import { Button } from "@/components/ui/button";
import { PROSPECT_STATUS_TONES } from "@/lib/antidotes/colors";
import {
  PROSPECT_STATUSES,
  PROSPECT_STATUS_LABELS,
  type PipelineProspect,
  type ProspectStatus,
} from "@/lib/antidotes/types";
import { cn } from "@/lib/utils";

/**
 * Le kanban : une colonne par statut, dans l'ordre du cycle de vente.
 *
 * Le déplacement est **optimiste** : la carte change de colonne au lâcher,
 * l'action serveur part derrière, et si elle échoue la carte revient à sa
 * place avec un toast — un retour visible, jamais un état qui ment.
 *
 * Deux gestes sur la même carte, sans se marcher dessus : un clic l'ouvre,
 * un glissement de six pixels la déplace. Au clavier, Entrée ouvre, Espace
 * saisit — Entrée est retiré des touches de prise de dnd-kit pour que la
 * carte reste un bouton avant d'être un objet à déplacer.
 */

type StatusUpdate = { id: string; status: ProspectStatus };

export function PipelineBoard({
  prospects,
  onOpen,
}: {
  prospects: PipelineProspect[];
  onOpen: (prospectId: string) => void;
}) {
  const [optimistic, applyMove] = useOptimistic(
    prospects,
    (state: PipelineProspect[], update: StatusUpdate) =>
      state.map((row) => (row.id === update.id ? { ...row, status: update.status } : row)),
  );
  const [, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  /** La colonne dont on a pressé le « + » : le dialogue naît avec son statut. */
  const [creating, setCreating] = useState<ProspectStatus | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );

  const byStatus = new Map<ProspectStatus, PipelineProspect[]>(
    PROSPECT_STATUSES.map((status) => [status, []]),
  );
  for (const row of optimistic) byStatus.get(row.status)?.push(row);

  const active = activeId ? (optimistic.find((row) => row.id === activeId) ?? null) : null;

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const target = event.over?.id;
    const id = String(event.active.id);
    const row = optimistic.find((candidate) => candidate.id === id);
    if (!row || typeof target !== "string") return;
    const status = target as ProspectStatus;
    if (!PROSPECT_STATUSES.includes(status) || status === row.status) return;

    startTransition(async () => {
      applyMove({ id, status });
      const result = await moveProspects({ prospectIds: [id], status });
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Espace pour saisir un prospect, flèches pour changer de colonne, Espace pour déposer, Échap pour annuler.",
        },
        announcements: {
          onDragStart: ({ active }) => `Prospect saisi (${labelOf(active.id)}).`,
          onDragOver: ({ over }) =>
            over ? `Au-dessus de la colonne ${columnLabel(over.id)}.` : "Hors des colonnes.",
          onDragEnd: ({ over }) =>
            over ? `Déposé dans ${columnLabel(over.id)}.` : "Déplacement annulé.",
          onDragCancel: () => "Déplacement annulé.",
        },
      }}
    >
      <div className="flex gap-3 overflow-x-auto pb-2">
        {PROSPECT_STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            prospects={byStatus.get(status) ?? []}
            dragging={activeId !== null}
            onOpen={onOpen}
            onCreate={() => setCreating(status)}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {active ? <ProspectCard prospect={active} overlay className="w-64" /> : null}
      </DragOverlay>

      {/* Un seul dialogue pour huit colonnes : le statut change, pas le formulaire. */}
      <NewProspectFormDialog
        open={creating !== null}
        onOpenChange={(next) => {
          if (!next) setCreating(null);
        }}
        status={creating ?? undefined}
      />
    </DndContext>
  );

  function labelOf(id: string | number): string {
    return optimistic.find((row) => row.id === String(id))?.company_name ?? "";
  }
}

function columnLabel(id: string | number): string {
  return PROSPECT_STATUS_LABELS[id as ProspectStatus] ?? String(id);
}

function Column({
  status,
  prospects,
  dragging,
  onOpen,
  onCreate,
}: {
  status: ProspectStatus;
  prospects: PipelineProspect[];
  dragging: boolean;
  onOpen: (prospectId: string) => void;
  onCreate: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      ref={setNodeRef}
      aria-label={PROSPECT_STATUS_LABELS[status]}
      className={cn(
        "flex w-64 shrink-0 flex-col rounded-lg border bg-surface-sunken transition-[border-color,background-color] duration-(--motion-duration) ease-standard",
        isOver ? "border-border-strong bg-accent-subtle/40" : "border-border",
      )}
    >
      <header className="flex items-center gap-2 px-3 py-2">
        <StatusDot tone={PROSPECT_STATUS_TONES[status]} />
        <h3 className="type-label min-w-0 flex-1 truncate text-text-primary">
          {PROSPECT_STATUS_LABELS[status]}
        </h3>
        <span className="type-caption text-text-secondary tabular-nums">{prospects.length}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onCreate}
          aria-label={`Ajouter un prospect dans ${PROSPECT_STATUS_LABELS[status]}`}
          className="-mr-1.5 text-text-secondary hover:text-text-primary"
        >
          <Plus aria-hidden />
        </Button>
      </header>

      <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
        {prospects.map((prospect) => (
          <DraggableCard key={prospect.id} prospect={prospect} onOpen={onOpen} />
        ))}
        {/* Une colonne vide garde une zone de dépôt visible pendant un
            déplacement : sans elle, rien ne dit qu'on peut y lâcher la carte. */}
        {prospects.length === 0 && dragging ? (
          <div
            aria-hidden
            className="min-h-16 flex-1 rounded-md border border-dashed border-border-strong"
          />
        ) : null}
      </div>
    </section>
  );
}

function DraggableCard({
  prospect,
  onOpen,
}: {
  prospect: PipelineProspect;
  onOpen: (prospectId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: prospect.id,
    data: { status: prospect.status },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`${prospect.company_name} — ouvrir ou déplacer`}
      onClick={() => onOpen(prospect.id)}
      onKeyDown={(event) => {
        // Entrée ouvre le panneau ; Espace reste la prise de dnd-kit.
        if (event.key === "Enter") {
          event.preventDefault();
          onOpen(prospect.id);
          return;
        }
        listeners?.onKeyDown?.(event);
      }}
      className={cn(
        "focus-visible:ring-ring cursor-grab rounded-md outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:cursor-grabbing",
        // La carte d'origine s'efface sous le fantôme : on voit d'où elle part.
        isDragging && "opacity-30",
      )}
    >
      <ProspectCard prospect={prospect} />
    </div>
  );
}
