/**
 * Interface commune des connecteurs de planning.
 *
 * Monday est le seul aujourd'hui, mais l'interface existe pour la même raison
 * que `DataSourceConnector` côté régies : le jour où un client tient son
 * planning ailleurs (Notion, Airtable, un simple Google Sheet), seul un fichier
 * s'ajoute. Le domaine, lui, ne connaît que des mois, des couloirs et des
 * sujets.
 */

import type { MondayColumn } from "../monday-mapping";

export type BoardSummary = {
  id: string;
  name: string;
  url: string | null;
};

export type RemoteSubitem = {
  id: string;
  name: string;
  url: string | null;
  updatedAt: string | null;
  /** Valeurs de colonne, indexées par identifiant de colonne. */
  columnValues: Record<string, string | null>;
};

export type RemoteItem = {
  id: string;
  name: string;
  groupId: string;
  position: number;
  subitems: RemoteSubitem[];
};

export type RemoteGroup = {
  id: string;
  title: string;
  position: number;
};

export type BoardSnapshot = {
  board: BoardSummary;
  /** Colonnes des **sous-éléments** : c'est là que vivent les données utiles. */
  subitemColumns: MondayColumn[];
  subitemBoardId: string | null;
  groups: RemoteGroup[];
  items: RemoteItem[];
};

/**
 * Connecteur de reprise.
 *
 * En lecture seule, et c'est structurel : une fois l'année importée, le tableau
 * du dashboard fait autorité. Écrire des deux côtés créerait deux vérités et un
 * conflit à chaque modification.
 */
export interface PlanningConnector {
  readonly id: string;
  /** Boards dont le nom correspond à la recherche. */
  listBoards(searchTerm: string): Promise<BoardSummary[]>;
  fetchBoard(boardId: string): Promise<BoardSnapshot>;
}
