import { formatDayFr } from "@/lib/format";
import { PUBLISH_TRIGGER_STATUS, schedulingProblem } from "@/lib/publishing/readiness";

/**
 * Le refus, en toutes lettres, d'une programmation qui ne partirait jamais.
 *
 * Une ligne « Programmé » ne part que le jour de sa date : programmée sur une
 * date passée, ou sans date, elle resterait en attente pour toujours sans que
 * rien ne le dise. Le geste est donc refusé au moment où il est fait — passer
 * la ligne en « Programmé », ou redater une ligne déjà programmée — avec la
 * sortie : changer la date, ou publier maintenant.
 *
 * `null` quand rien ne coince, ou quand la ligne n'est pas programmée.
 */
export function schedulingRefusal(
  subject: { name: string | null; status: string | null; scheduled_on: string | null },
  now: Date,
): string | null {
  if (subject.status !== PUBLISH_TRIGGER_STATUS) return null;
  const problem = schedulingProblem(subject, now);
  if (!problem) return null;

  const label = subject.name?.trim() ? `« ${subject.name.trim()} »` : "Cette publication";
  if (problem === "no_date") {
    return `${label} n'a pas de date : choisis-en une pour la programmer.`;
  }
  return `${label} est antidatée (${formatDayFr(subject.scheduled_on)}) : change sa date ou publie-la maintenant.`;
}

/** Le même refus pour une sélection : le premier tel quel, plusieurs comptés. */
export function bulkSchedulingRefusal(
  subjects: { name: string | null; status: string | null; scheduled_on: string | null }[],
  now: Date,
): string | null {
  const refusals = subjects
    .map((subject) => schedulingRefusal(subject, now))
    .filter((refusal): refusal is string => refusal !== null);
  if (refusals.length === 0) return null;
  if (refusals.length === 1) return refusals[0];
  return `${refusals.length} publications sont antidatées ou sans date : change leur date ou publie-les maintenant.`;
}
