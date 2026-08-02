/**
 * Connecteur Monday.com.
 *
 * Le jeton est un jeton personnel d'API, lu dans `MONDAY_API_TOKEN` — sans
 * préfixe `NEXT_PUBLIC_`, donc remplacé par `undefined` dans tout bundle
 * navigateur : la clé ne peut pas fuiter, même si ce module était importé par
 * erreur depuis un composant client. Le marqueur `server-only` est volontairement
 * absent, le job `pnpm sync:planning` important ce fichier depuis Node.
 *
 * L'API Monday facture en « points de complexité » plutôt qu'en requêtes : une
 * requête qui ramène tout un board d'un coup coûte moins cher que trente
 * requêtes ciblées. Les sous-éléments sont donc chargés avec leurs éléments
 * parents, en une passe paginée.
 */

import type { MondayColumn } from "../monday-mapping";
import type {
  BoardSnapshot,
  BoardSummary,
  PlanningConnector,
  RemoteItem,
  RemoteSubitem,
} from "./types";

const API_URL = "https://api.monday.com/v2";
const API_VERSION = "2024-10";
const PAGE_SIZE = 100;

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
  error_message?: string;
};

type RawColumnValue = { id: string; text: string | null; value: string | null };

type RawSubitem = {
  id: string;
  name: string;
  url: string | null;
  updated_at: string | null;
  column_values: RawColumnValue[];
};

type RawItem = {
  id: string;
  name: string;
  group: { id: string } | null;
  subitems: RawSubitem[] | null;
};

export class MondayConnector implements PlanningConnector {
  readonly id = "monday";

  constructor(private readonly token: string) {
    if (!token) throw new Error("MONDAY_API_TOKEN absent.");
  }

  /** `null` quand aucun jeton n'est configuré — l'appelant reste sur le miroir. */
  static fromEnv(): MondayConnector | null {
    const token = process.env.MONDAY_API_TOKEN;
    return token ? new MondayConnector(token) : null;
  }

  private async request<T>(
    query: string,
    variables: Record<string, unknown> = {},
  ): Promise<T> {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.token,
        "API-Version": API_VERSION,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Monday a répondu ${response.status}.`);
    }

    const payload = (await response.json()) as GraphQLResponse<T>;

    // Monday renvoie parfois un 200 portant une erreur : l'ignorer donnerait
    // une synchronisation « réussie » qui n'a rien ramené.
    if (payload.errors?.length) {
      throw new Error(payload.errors.map((error) => error.message).join(" · "));
    }
    if (payload.error_message) throw new Error(payload.error_message);
    if (!payload.data) throw new Error("Réponse Monday vide.");

    return payload.data;
  }

  async listBoards(searchTerm: string): Promise<BoardSummary[]> {
    const data = await this.request<{
      boards: { id: string; name: string; url: string | null }[];
    }>(
      `query ($limit: Int!) {
         boards (limit: $limit, order_by: used_at, state: active) {
           id name url
         }
       }`,
      { limit: 200 },
    );

    const needle = searchTerm.trim().toLowerCase();
    return data.boards
      .filter((board) => board.name.toLowerCase().includes(needle))
      .map((board) => ({ id: board.id, name: board.name, url: board.url }));
  }

  async fetchBoard(boardId: string): Promise<BoardSnapshot> {
    const head = await this.request<{
      boards: {
        id: string;
        name: string;
        url: string | null;
        groups: { id: string; title: string }[];
        columns: { id: string; title: string; type: string }[];
      }[];
    }>(
      `query ($ids: [ID!]) {
         boards (ids: $ids) {
           id name url
           groups { id title }
           columns { id title type }
         }
       }`,
      { ids: [boardId] },
    );

    const board = head.boards[0];
    if (!board) throw new Error(`Board ${boardId} introuvable.`);

    const { items, subitemBoardId, subitemColumns } = await this.fetchItems(boardId);

    return {
      board: { id: board.id, name: board.name, url: board.url },
      // Le board parent ne porte que le nom de la plateforme : les colonnes qui
      // comptent sont celles du board de sous-éléments.
      subitemColumns:
        subitemColumns ??
        board.columns.map(
          (column): MondayColumn => ({
            id: column.id,
            title: column.title,
            type: column.type,
          }),
        ),
      subitemBoardId,
      groups: board.groups.map((group, index) => ({
        id: group.id,
        title: group.title,
        position: index,
      })),
      items,
    };
  }

  /** Pagination par curseur : les boards d'archive dépassent la page unique. */
  private async fetchItems(boardId: string): Promise<{
    items: RemoteItem[];
    subitemBoardId: string | null;
    subitemColumns: MondayColumn[] | null;
  }> {
    const items: RemoteItem[] = [];
    let cursor: string | null = null;
    let position = 0;
    let subitemBoardId: string | null = null;
    let subitemColumns: MondayColumn[] | null = null;

    do {
      const page: {
        boards: {
          items_page: { cursor: string | null; items: RawItem[] };
        }[];
      } = await this.request(
        `query ($ids: [ID!], $limit: Int!, $cursor: String) {
           boards (ids: $ids) {
             items_page (limit: $limit, cursor: $cursor) {
               cursor
               items {
                 id name
                 group { id }
                 subitems {
                   id name url updated_at
                   board { id columns { id title type } }
                   column_values { id text value }
                 }
               }
             }
           }
         }`,
        { ids: [boardId], limit: PAGE_SIZE, cursor },
      );

      const itemsPage = page.boards[0]?.items_page;
      if (!itemsPage) break;

      for (const raw of itemsPage.items) {
        const subitems: RemoteSubitem[] = (raw.subitems ?? []).map((subitem) => {
          // Le board de sous-éléments et ses colonnes sont les mêmes pour tout
          // le board : le premier sous-élément rencontré suffit à les connaître.
          const withBoard = subitem as RawSubitem & {
            board?: { id: string; columns: MondayColumn[] } | null;
          };
          if (withBoard.board && !subitemBoardId) {
            subitemBoardId = withBoard.board.id;
            subitemColumns = withBoard.board.columns.map((column) => ({
              id: column.id,
              title: column.title,
              type: column.type,
            }));
          }

          return {
            id: subitem.id,
            name: subitem.name,
            url: subitem.url,
            updatedAt: subitem.updated_at,
            columnValues: Object.fromEntries(
              subitem.column_values.map((column) => [
                column.id,
                // `text` est la valeur lisible ; `value` porte le JSON brut, seul
                // exploitable pour les fichiers.
                column.text && column.text.length > 0 ? column.text : column.value,
              ]),
            ),
          };
        });

        items.push({
          id: raw.id,
          name: raw.name,
          groupId: raw.group?.id ?? "",
          position: position++,
          subitems,
        });
      }

      cursor = itemsPage.cursor;
    } while (cursor);

    return { items, subitemBoardId, subitemColumns };
  }

}
