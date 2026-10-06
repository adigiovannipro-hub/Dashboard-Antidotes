/**
 * Où en est une facture partie : l'envoi, les trois relances, la suivante.
 *
 * Fonction **pure** : le journal entre, le suivi sort. Elle relit la cadence
 * de `relances.ts` (`REMINDER_SCHEDULE`) et la même règle de rattrapage que
 * `decideEnvoi`, pour que l'écran annonce exactement ce que l'automate fera —
 * deux calendriers qui divergent feraient promettre une relance qui ne part
 * pas.
 */

import { daysSince, REMINDER_SCHEDULE } from "./relances";
import type { BillingEmailKind } from "./types";

/** Une étape du suivi : l'envoi initial, puis chaque relance. */
export type DeliveryStep = {
  kind: BillingEmailKind;
  /** Horodatage d'envoi, `null` tant que l'étape n'est pas partie. */
  sentAt: string | null;
  /** Jour prévu (`AAAA-MM-JJ`) — `null` pour l'envoi initial. */
  dueOn: string | null;
};

export type DeliveryTrack = {
  /** Toujours quatre : envoi, relance 1, relance 2, relance 3. */
  steps: DeliveryStep[];
  /** La dernière relance partie, s'il y en a une. */
  lastReminder: DeliveryStep | null;
  /**
   * La relance qui partira ensuite — au passage du jour si elle est déjà
   * due. `null` quand les trois sont parties.
   */
  next: { kind: BillingEmailKind; dueOn: string } | null;
};

/** Le jour (UTC) qui suit un horodatage de `days` jours. */
function dayAfter(isoTimestamp: string, days: number): string {
  const start = new Date(isoTimestamp);
  const day = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  return new Date(day + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Le suivi d'une mensualité, ou `null` si la facture n'est pas partie par
 * l'envoi automatique : sans envoi initial au journal, aucune relance n'est
 * à attendre — la facture a été envoyée à la main, ou pas encore du tout.
 */
export function deliveryTrack(
  emails: readonly { kind: BillingEmailKind; sent_at: string }[],
  now: Date = new Date(),
): DeliveryTrack | null {
  const sentByKind = new Map(emails.map((mail) => [mail.kind, mail.sent_at]));
  const initial = sentByKind.get("invoice");
  if (!initial) return null;

  const reminders: DeliveryStep[] = REMINDER_SCHEDULE.map((step) => ({
    kind: step.kind,
    sentAt: sentByKind.get(step.kind) ?? null,
    dueOn: dayAfter(initial, step.afterDays),
  }));

  const lastReminder =
    [...reminders].reverse().find((step) => step.sentAt !== null) ?? null;

  /* Même règle que `decideEnvoi` : si une ou plusieurs relances sont dues et
     pas parties, c'est la plus récente qui part — aujourd'hui. Sinon, la
     première dont la date n'est pas encore atteinte. */
  const elapsed = daysSince(initial, now);
  const today = now.toISOString().slice(0, 10);
  let next: DeliveryTrack["next"] = null;
  for (const [index, step] of REMINDER_SCHEDULE.entries()) {
    if (elapsed >= step.afterDays && !sentByKind.has(step.kind)) {
      next = { kind: step.kind, dueOn: today };
    }
    if (next === null && elapsed < step.afterDays && !sentByKind.has(step.kind)) {
      next = { kind: step.kind, dueOn: reminders[index]!.dueOn! };
      break;
    }
  }

  return {
    steps: [{ kind: "invoice", sentAt: initial, dueOn: null }, ...reminders],
    lastReminder,
    next,
  };
}

/**
 * Un devis soldé : au moins une mensualité payée, et plus rien à encaisser —
 * toutes les autres payées ou passées. Un devis sans ligne, ou dont toutes
 * les lignes ont été passées, ne l'est pas : rien n'y a été réglé.
 */
export function isEngagementSettled(
  lines: readonly { status: "pending" | "issued" | "paid" | "skipped" }[],
): boolean {
  return (
    lines.some((line) => line.status === "paid") &&
    lines.every((line) => line.status === "paid" || line.status === "skipped")
  );
}
