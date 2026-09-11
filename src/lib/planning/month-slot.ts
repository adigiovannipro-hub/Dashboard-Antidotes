/**
 * « Ce mois est-il déjà au tableau, et sous quelle forme ? »
 *
 * `planning_months` porte `unique (board_id, month)` **totale**, et la
 * corbeille est une suppression douce : la ligne d'un mois jeté occupe
 * toujours la place. Insérer par-dessus se heurte donc au 23505 — c'est ce
 * qui faisait qu'« Ajouter un mois » ne recréait jamais un mois supprimé, tout
 * en affichant un toast vert : l'erreur portait le mot « duplicate » et
 * l'action l'avalait.
 *
 * La décision vit ici, hors de tout accès à la base, pour qu'elle se teste.
 */

/** Ce que la base sait du mois visé — `null` : elle n'en sait rien. */
export type MonthSlotRow = {
  id: string;
  /** Corbeille (migration 0031) — `null` : le mois est au tableau. */
  deleted_at: string | null;
};

export type MonthSlot =
  /** Aucune ligne : le mois se crée. */
  | { action: "insert" }
  /** Ligne à la corbeille : elle se relève, plutôt qu'une seconde à côté. */
  | { action: "restore"; monthId: string }
  /** Ligne vivante : le mois est déjà là, il n'y a rien à faire. */
  | { action: "keep"; monthId: string };

export function evaluateMonthSlot(
  existing: MonthSlotRow | null | undefined,
): MonthSlot {
  if (!existing) return { action: "insert" };

  return existing.deleted_at
    ? { action: "restore", monthId: existing.id }
    : { action: "keep", monthId: existing.id };
}
