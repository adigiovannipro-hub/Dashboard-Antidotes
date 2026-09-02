import type { FinanceRetrievalSource } from "./types";

/**
 * La récupération automatique des factures, côté décision.
 *
 * Le dashboard ne télécharge rien : il retient le lien d'un fournisseur, la
 * date de la dernière facture récupérée, et connaît les prélèvements par la
 * synchronisation Airwallex. C'est ici que se juge ce que la cellule affiche
 * et ce que le passage extérieur a à faire aujourd'hui. Une seule vérité pour
 * les deux : si l'écran disait « Récupéré » là où le passage repasserait, on
 * ne saurait plus qui croire.
 *
 * Le passage ne va chercher une facture que **le lendemain du prélèvement**
 * du mois — pas chaque jour : la facture n'existe pas avant, et la chercher
 * la veille rapporterait celle du mois dernier.
 *
 * Fonctions pures, zéro import Supabase. Les dates se comparent en UTC,
 * comme toute date du projet.
 */

export type RetrievalCellState =
  /** Pas de lien : le bouton invite à en coller un. */
  | { kind: "none" }
  /** Lien posé, facture du mois pas encore arrivée — le passage s'en charge
      le lendemain du prélèvement. C'est aussi l'état d'une fiche récupérée un
      mois précédent : le mois a tourné, le bouton se réarme tout seul. */
  | { kind: "pending"; link: string }
  /** Le dernier passage a échoué ; la cause s'affiche, le suivant réessaie. */
  | { kind: "failed"; link: string; error: string | null }
  /** Récupérée ce mois-ci : bouton vert, inerte, daté. */
  | { kind: "done"; link: string; retrievedAt: string };

/** Pourquoi une fiche n'est pas à traiter aujourd'hui — ou l'est. */
export type RetrievalReason =
  | "due"
  | "no-link"
  | "done-this-month"
  | "no-charge-this-month"
  | "charge-too-recent"
  | "failed-recently";

export const RETRIEVAL_REASON_LABELS: Record<RetrievalReason, string> = {
  due: "À récupérer aujourd'hui",
  "no-link": "Sans lien",
  "done-this-month": "Facture du mois déjà récupérée",
  "no-charge-this-month": "Aucun prélèvement ce mois-ci pour l'instant",
  "charge-too-recent": "Prélèvement d'aujourd'hui — passage demain",
  "failed-recently": "Échec récent — nouvel essai dans trois jours",
};

export type RetrievalDecision = {
  due: boolean;
  reason: RetrievalReason;
  /** Le jour du passage, `AAAA-MM-JJ` UTC — le lendemain du prélèvement. */
  dueOn: string | null;
};

/** Un échec ne se réessaie pas tous les jours : trois jours entre deux. */
const RETRY_AFTER_FAILURE_DAYS = 3;

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

/** Le jour UTC d'un instant, `AAAA-MM-JJ`. */
export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Un jour `AAAA-MM-JJ` décalé de `days` jours, en UTC. */
export function addUtcDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return utcDay(date);
}

/** La facture du mois courant est déjà là. */
export function isRetrievedThisMonth(
  source: Pick<FinanceRetrievalSource, "retrieval_status" | "auto_retrieved_at">,
  now: Date,
): boolean {
  return source.retrieval_status === "done" && sameUtcMonth(source.auto_retrieved_at, now);
}

/**
 * Ce que le passage doit faire d'une fiche aujourd'hui.
 *
 * `lastChargeAt` est le dernier prélèvement carte connu de ce marchand. Le
 * passage n'a lieu que si ce prélèvement est du mois courant et date d'au
 * moins la veille : avant, la facture n'est pas encore émise ; sans
 * prélèvement ce mois-ci, il n'y a rien à chercher. Un échec attend trois
 * jours avant un nouvel essai — un site en panne un matin ne justifie pas
 * trente tentatives.
 */
export function decideRetrieval(input: {
  source: Pick<
    FinanceRetrievalSource,
    "source_link" | "retrieval_status" | "auto_retrieved_at" | "updated_at"
  >;
  lastChargeAt: string | null;
  now: Date;
}): RetrievalDecision {
  const { source, lastChargeAt, now } = input;

  if (!source.source_link) return { due: false, reason: "no-link", dueOn: null };
  if (isRetrievedThisMonth(source, now)) {
    return { due: false, reason: "done-this-month", dueOn: null };
  }

  const charge = lastChargeAt ? new Date(lastChargeAt) : null;
  if (!charge || Number.isNaN(charge.getTime()) || !sameUtcMonth(lastChargeAt, now)) {
    return { due: false, reason: "no-charge-this-month", dueOn: null };
  }

  const dueOn = addUtcDays(utcDay(charge), 1);
  if (utcDay(now) < dueOn) return { due: false, reason: "charge-too-recent", dueOn };

  if (source.retrieval_status === "failed") {
    const retryOn = addUtcDays(utcDay(new Date(source.updated_at)), RETRY_AFTER_FAILURE_DAYS);
    if (utcDay(now) < retryOn) return { due: false, reason: "failed-recently", dueOn: retryOn };
  }

  return { due: true, reason: "due", dueOn };
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
