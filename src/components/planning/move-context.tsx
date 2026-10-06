"use client";

import { createContext, useContext, useMemo, useOptimistic, useRef, type ReactNode } from "react";

import type { PendingMove } from "@/lib/planning/moves";
import type { SubjectRow } from "@/lib/planning/types";

/**
 * Les déplacements par glisser-déposer, posés à l'écran avant le serveur.
 *
 * Au niveau du tableau et non du couloir : une ligne qui change de réseau doit
 * disparaître de l'un et apparaître dans l'autre au même instant. `useOptimistic`
 * retire le déplacement quand la transition s'achève — c'est-à-dire quand la
 * revalidation apporte les lignes du serveur, déjà dans le bon ordre.
 *
 * Deux contextes : la ligne en main est une référence stable, que les lignes
 * lisent sans se redessiner à chaque déplacement ; seuls les couloirs suivent
 * la liste des déplacements.
 */
type DraggedRow = { set: (row: SubjectRow | null) => void; get: () => SubjectRow | null };
type MovesValue = { moves: readonly PendingMove[]; addMove: (move: PendingMove) => void };

const MovesContext = createContext<MovesValue | null>(null);
const INERT: DraggedRow = { set: () => {}, get: () => null };
const DraggedContext = createContext<DraggedRow>(INERT);

export function MoveProvider({ children }: { children: ReactNode }) {
  const [moves, addMove] = useOptimistic<PendingMove[], PendingMove>([], (current, move) => [
    ...current,
    move,
  ]);
  const draggedRef = useRef<SubjectRow | null>(null);
  const dragged = useMemo<DraggedRow>(
    () => ({
      set: (row) => {
        draggedRef.current = row;
      },
      get: () => draggedRef.current,
    }),
    [],
  );
  return (
    <DraggedContext value={dragged}>
      <MovesContext value={{ moves, addMove }}>{children}</MovesContext>
    </DraggedContext>
  );
}

const NO_MOVES: MovesValue = { moves: [], addMove: () => {} };

/** Hors tableau (Mon travail), rien ne se déplace : un contexte inerte. */
export function useMoves(): MovesValue & { dragged: DraggedRow } {
  return { ...(useContext(MovesContext) ?? NO_MOVES), dragged: useContext(DraggedContext) };
}

/** La ligne en main, posée au début du glisser. */
export function useDraggedRow(): DraggedRow {
  return useContext(DraggedContext);
}
