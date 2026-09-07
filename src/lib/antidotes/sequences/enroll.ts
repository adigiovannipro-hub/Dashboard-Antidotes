/**
 * Ce qu'une inscription décide à l'instant où on la pose — module pur, partagé
 * par la Server Action et ses tests.
 *
 * Le canal est **figé** ici, d'après `outreach_channel` du contact : `valid`
 * → email, `risky` → piste LinkedIn manuelle, le reste → refus. Une adresse
 * `unknown` n'a pas été vérifiée, et le cahier des charges est formel : la
 * vérification n'est pas optionnelle.
 */

import type { Contact, OutreachChannel, SequenceStep } from "../types";
import { stepDueAt, type SendWindow } from "./schedule";

export type EnrollmentDecision =
  | { ok: true; channel: "email" | "linkedin"; next_send_at: string | null }
  | { ok: false; reason: string };

export const ENROLLMENT_REFUSALS = {
  opted_out: "contact désinscrit",
  no_channel: "adresse non vérifiée",
  invalid: "adresse invalide",
  no_email: "sans adresse",
  no_steps: "séquence sans étape",
  closed_window: "fenêtre d'envoi fermée en permanence",
} as const;

export function decideEnrollment(options: {
  contact: Pick<Contact, "email" | "email_status" | "opted_out" | "outreach_channel">;
  steps: Pick<SequenceStep, "delay_days">[];
  window: SendWindow;
  now: Date;
}): EnrollmentDecision {
  const { contact } = options;
  if (contact.opted_out) return { ok: false, reason: ENROLLMENT_REFUSALS.opted_out };

  const channel: OutreachChannel = contact.outreach_channel;
  if (channel === "linkedin") {
    // La piste LinkedIn n'a pas de calendrier : la tâche est à faire, point.
    return { ok: true, channel: "linkedin", next_send_at: null };
  }
  if (channel !== "email") {
    return {
      ok: false,
      reason:
        contact.email_status === "invalid"
          ? ENROLLMENT_REFUSALS.invalid
          : contact.email
            ? ENROLLMENT_REFUSALS.no_channel
            : ENROLLMENT_REFUSALS.no_email,
    };
  }
  if (!contact.email) return { ok: false, reason: ENROLLMENT_REFUSALS.no_email };
  if (options.steps.length === 0) return { ok: false, reason: ENROLLMENT_REFUSALS.no_steps };

  const first = [...options.steps].sort((a, b) => a.delay_days - b.delay_days)[0]!;
  const due = stepDueAt(options.now, first.delay_days, options.window);
  if (!due) return { ok: false, reason: ENROLLMENT_REFUSALS.closed_window };
  return { ok: true, channel: "email", next_send_at: due.toISOString() };
}

/** La clé d'idempotence de la tâche « Mon travail » d'une piste LinkedIn. */
export function linkedinTaskKey(enrollmentId: string): string {
  return `antidotes:linkedin:${enrollmentId}`;
}

export function linkedinTaskTitle(options: { contactName: string; companyName: string }): string {
  return `LinkedIn · ${options.contactName} (${options.companyName})`;
}
