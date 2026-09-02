import type { FinanceRetrievalSource } from "./types";

/**
 * La récupération automatique des factures, côté décision.
 *
 * Le dashboard ne télécharge rien : il retient le lien d'un fournisseur et la
 * date de la dernière facture récupérée, et c'est ici que se juge ce que la
 * cellule affiche et ce que le passage extérieur a encore à faire. Une seule
 * vérité pour les deux : si l'écran disait « Récupéré » là où le passage
 * repasserait, ou l'inverse, on ne saurait plus qui croire.
 *
 * Fonctions pures, zéro import Supabase : elles se testent à la seconde.
 * Le mois se compare en UTC, comme toute date du projet.
 */

export type RetrievalCellState =
  /** Pas de lien : le bouton « Récupérer » invite à en coller un. */
  | { kind: "none" }
  /** Lien posé, facture du mois pas encore arrivée — le passage extérieur
      s'en charge. C'est aussi l'état d'une fiche récupérée un mois précédent :
      le mois a tourné, le bouton se réarme tout seul. */
  | { kind: "pending"; link: string }
  /** Le dernier passage a échoué ; la cause s'affiche, le suivant réessaie. */
  | { kind: "failed"; link: string; error: string | null }
  /** Récupérée ce mois-ci : bouton vert, inerte, daté. */
  | { kind: "done"; link: string; retrievedAt: string };

/** Deux instants dans le même mois calendaire, en UTC. */
export function sameUtcMonth(iso: string | null | undefined, now: Date): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getUTCFullYear() === now.getUTCFullYear() &&
    date.getUTCMonth() === now.getUTCMonth()
  );
}

/** La facture du mois courant est déjà là. */
export function isRetrievedThisMonth(
  source: Pick<FinanceRetrievalSource, "retrieval_status" | "auto_retrieved_at">,
  now: Date,
): boolean {
  return source.retrieval_status === "done" && sameUtcMonth(source.auto_retrieved_at, now);
}

/**
 * Ce que le passage extérieur doit encore traiter : une fiche avec un lien,
 * dont la facture du mois n'est pas arrivée. Un échec y reste — il se
 * réessaie — et un succès du mois dernier y revient tout seul.
 */
export function isDueForRetrieval(
  source: Pick<FinanceRetrievalSource, "source_link" | "retrieval_status" | "auto_retrieved_at">,
  now: Date,
): boolean {
  if (!source.source_link) return false;
  return !isRetrievedThisMonth(source, now);
}

/** L'état de la cellule d'une dépense, depuis la fiche de son marchand. */
export function retrievalCellState(
  source: FinanceRetrievalSource | null | undefined,
  now: Date,
): RetrievalCellState {
  if (!source?.source_link) return { kind: "none" };
  const link = source.source_link;

  if (isRetrievedThisMonth(source, now)) {
    return { kind: "done", link, retrievedAt: source.auto_retrieved_at! };
  }
  if (source.retrieval_status === "failed") {
    return { kind: "failed", link, error: source.last_error };
  }
  return { kind: "pending", link };
}

/** Le mois courant au format `AAAA-MM`, en UTC — celui que le passage annonce. */
export function currentUtcMonth(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}
