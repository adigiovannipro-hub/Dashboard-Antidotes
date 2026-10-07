"use client";

import { createContext, useContext } from "react";

/**
 * « Enregistrer » d'un tri, posé dans l'en-tête de la colonne triée, à côté
 * de sa flèche — il vivait dans une barre collante en haut du tableau, loin
 * du geste qui l'avait fait naître. Contexte plutôt que props : l'en-tête est
 * trois composants plus bas que le tableau qui sait écrire l'ordre.
 */
export type SortSave = { save: () => void; pending: boolean };

const SortSaveContext = createContext<SortSave | null>(null);

export const SortSaveProvider = SortSaveContext.Provider;

export function useSortSave(): SortSave | null {
  return useContext(SortSaveContext);
}
