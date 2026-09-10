import type { InstallmentStage } from "./types";

/**
 * Le tri d'un groupe du board Échéances.
 *
 * Module **pur** : les rangées entrent, une clé de tri en sort, rien n'est lu
 * en base. Chaque groupe se trie **chez lui** — le paramètre d'URL porte son
 * nom (`?tri-payee=montant-desc`), parce que trier « Payée » par montant n'a
 * aucune raison de retourner « À facturer » du même coup.
 *
 * Deux formes de rangée cohabitent dans ces groupes — une mensualité de devis
 * et une facture Airwallex hors devis. Le tri ne les distingue pas : chacune
 * expose la même `BoardSortKey`, et c'est l'appelant qui sait la fabriquer.
 *
 * **Le tri par défaut de chaque groupe reste le défaut** : sans paramètre,
 * `sortBoardRows` ne touche à rien. Il encode une décision produit (les
 * retards en bas de « Facturée », les payées du plus récent au plus ancien)
 * qu'un tri alphabétique ne remplace pas. Et le tri demandé s'applique
 * par-dessus l'ordre reçu : le tri de JavaScript est stable, donc deux lignes
 * de même montant restent dans l'ordre du groupe.
 */

export type BoardSortField = "client" | "periode" | "montant";
export type BoardSortDirection = "asc" | "desc";
export type BoardSort = { field: BoardSortField; direction: BoardSortDirection };

export const BOARD_SORT_LABELS: Record<BoardSortField, string> = {
  client: "Client",
  periode: "Période",
  montant: "Montant",
};

/** Les quatre groupes du board, et le paramètre d'URL de chacun. */
export type BoardGroupStage = Extract<
  InstallmentStage,
  "to_invoice" | "invoiced" | "paid" | "confirmed"
>;

export const GROUP_SORT_PARAMS: Record<BoardGroupStage, string> = {
  to_invoice: "tri-a-facturer",
  invoiced: "tri-facturee",
  paid: "tri-payee",
  confirmed: "tri-devis",
};

/** Ce qu'une rangée expose au tri, quelle que soit sa forme. */
export type BoardSortKey = {
  /** Le client tel qu'il s'affiche. */
  client: string;
  /** La date qui situe la rangée : mois de prestation ou jour d'émission. */
  date: string;
  /** Le montant affiché, en centimes de sa devise. */
  cents: number;
  currency: string;
};

/** Une date absente ne doit pas passer pour la plus ancienne : elle part au
    bout de la file, comme la fin des temps. */
const FIN_DES_TEMPS = "9999-12-31";

/** « montant-desc » → `{ field: "montant", direction: "desc" }`. Une valeur
    illisible ne casse rien : le groupe garde son ordre par défaut. */
export function parseBoardSort(value: string | null | undefined): BoardSort | null {
  if (!value) return null;
  const [field, direction] = value.split("-");
  if (field !== "client" && field !== "periode" && field !== "montant") return null;
  if (direction !== "asc" && direction !== "desc") return null;
  return { field, direction };
}

export function serializeBoardSort(sort: BoardSort): string {
  return `${sort.field}-${sort.direction}`;
}

/**
 * Le sens attendu au premier clic sur une colonne : un nom se lit de A à Z, un
 * montant du plus gros au plus petit — personne ne cherche d'abord la plus
 * petite facture.
 */
export function firstDirectionOf(field: BoardSortField): BoardSortDirection {
  return field === "montant" ? "desc" : "asc";
}

export function compareBoardKeys(
  a: BoardSortKey,
  b: BoardSortKey,
  sort: BoardSort,
): number {
  const sens = sort.direction === "desc" ? -1 : 1;

  if (sort.field === "client") {
    /* Insensible à la casse et aux accents : « Écran » et « ecran » sont le
       même client, les séparer ferait deux blocs dans la liste. */
    return sens * a.client.localeCompare(b.client, "fr", { sensitivity: "base" });
  }

  if (sort.field === "periode") {
    const gauche = a.date || FIN_DES_TEMPS;
    const droite = b.date || FIN_DES_TEMPS;
    return sens * gauche.localeCompare(droite);
  }

  /* Deux devises ne se comparent pas — aucun taux de change n'existe dans ce
     dépôt. Elles se rangent l'une après l'autre plutôt que de s'entremêler sur
     des nombres qui ne veulent pas dire la même chose. */
  if (a.currency !== b.currency) return a.currency.localeCompare(b.currency);
  return sens * (a.cents - b.cents);
}

/**
 * Les rangées triées. `sort` à `null` rend la liste **telle quelle** — le tri
 * par défaut du groupe est déjà une réponse.
 */
export function sortBoardRows<T>(
  rows: readonly T[],
  keyOf: (row: T) => BoardSortKey,
  sort: BoardSort | null,
): T[] {
  if (!sort) return [...rows];
  return [...rows].sort((a, b) => compareBoardKeys(keyOf(a), keyOf(b), sort));
}
