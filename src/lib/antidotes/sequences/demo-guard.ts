import type { SequenceEnrollment } from "../types";
import type { EnrollmentBundle, PassageStore } from "./passage";

/**
 * La garde contre les inscriptions de démonstration.
 *
 * `pnpm seed:antidotes` pose des inscriptions déjà « parties », avec un fil
 * inventé — `demo-thread-<prospect>` — là où Gmail range un identifiant
 * hexadécimal. Le passage les traitait comme les autres : un refus 400 de
 * Gmail par fil et par passage, en JSON brut dans le journal du workflow, et
 * une relance qui tentait de partir *dans* ce fil — c'est le 400 qui l'a
 * retenue, pas nous. Un fil qui ne ressemble pas à un identifiant Gmail n'a
 * jamais existé : on ne le relit pas, et on n'y répond pas.
 *
 * Pur, pour être testé : c'est une règle qui décide de ne pas écrire à
 * quelqu'un. Elle ne voit que ce qui porte une trace — une inscription de
 * démo qui n'a encore rien envoyé n'a ni fil ni Message-ID, et rien ne la
 * distingue d'une vraie. C'est `pnpm seed:antidotes --reset` qui la retire.
 */

/** Gmail identifie fils et messages par un entier 64 bits rendu en hexadécimal. */
const GMAIL_ID = /^[0-9a-f]{8,32}$/i;

export function isGmailThreadId(value: string | null | undefined): boolean {
  return typeof value === "string" && GMAIL_ID.test(value);
}

export function isDemoEnrollment(enrollment: Pick<SequenceEnrollment, "thread_id">): boolean {
  return enrollment.thread_id !== null && !isGmailThreadId(enrollment.thread_id);
}

/** La ligne du journal, au singulier comme au pluriel. */
export function demoEnrollmentNotice(count: number): string {
  if (count <= 1) {
    return "1 inscription de démonstration, ignorée — pnpm seed:antidotes --reset pour la retirer";
  }
  return `${count} inscriptions de démonstration, ignorées — pnpm seed:antidotes --reset pour les retirer`;
}

/**
 * Le même dépôt, moins les inscriptions de démonstration sur les deux
 * lectures qui mènent à Gmail : les fils à relire et les envois dus. Les
 * autres lectures — inscriptions à préparer, compteurs, écritures — ne
 * touchent pas la boîte et passent telles quelles. `onDemo` reçoit chaque
 * inscription écartée ; une même inscription peut l'être aux deux lectures,
 * c'est à l'appelant de compter par identifiant.
 */
export function withoutDemoEnrollments(
  store: PassageStore,
  onDemo: (bundle: EnrollmentBundle) => void,
): PassageStore {
  const keep = (bundles: EnrollmentBundle[]): EnrollmentBundle[] =>
    bundles.filter((bundle) => {
      if (!isDemoEnrollment(bundle.enrollment)) return true;
      onDemo(bundle);
      return false;
    });
  return {
    ...store,
    async listThreadsToCheck(options) {
      return keep(await store.listThreadsToCheck(options));
    },
    async listDue(options) {
      return keep(await store.listDue(options));
    },
  };
}
