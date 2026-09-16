/**
 * Le passage des séquences — ce que la portée `sequences` du workflow exécute, et ce que
 * le bouton « Passer maintenant » rejoue à la demande.
 *
 * Orchestration **pure** : la persistance (`PassageStore`), la boîte mail
 * (`Mailer`) et l'observateur (`Observer`) sont injectés — une doublure en
 * test, Supabase, Gmail et Claude en production. Trois temps, dans cet ordre,
 * et l'ordre est une décision :
 *
 *   1. **Relever les fils** — réponses, rebonds, répondeurs. Avant d'envoyer,
 *      parce qu'une réponse arrivée cette nuit doit arrêter la relance de ce
 *      matin, et qu'un rebond doit compter dans la garde avant qu'on décide
 *      d'envoyer.
 *   2. **Préparer** les inscriptions qui attendent leur observation — au plus
 *      quelques-unes par passage, c'est un appel de modèle chacune.
 *   3. **Envoyer** ce qui est dû, dans la fenêtre, sous le plafond quotidien
 *      de chaque séquence, et seulement si la garde des rebonds laisse
 *      passer. Un email ne part **jamais** avec une variable manquante :
 *      l'inscription se met en pause avec la raison, l'écran la montre.
 *
 * Rien ici ne lève : chaque inscription échoue seule, l'erreur s'écrit sur
 * elle (`last_error`) et le rapport la répète.
 */

import type { Contact, Prospect, Sequence, SequenceEnrollment, SequenceStep } from "../types";
import { resolveSequenceSettings, type SequenceSettings } from "./defaults";
import {
  buildOutreachMime,
  newMessageId,
  replySubject,
  type OutreachEmail,
} from "./mime";
import { classifyThread, type ThreadMessage } from "./replies";
import { isInWindow, parisDayStart, stepDueAt } from "./schedule";
import { evaluateBounceGuard, type BounceGuard } from "./stats";
import { greetingName, renderTemplate, type TemplateContext } from "./templates";

export type EnrollmentBundle = {
  enrollment: SequenceEnrollment;
  contact: Contact;
  prospect: Prospect;
  sequence: Sequence;
  steps: SequenceStep[];
};

export type InteractionInsert = {
  org_id: string;
  prospect_id: string;
  contact_id: string | null;
  type: "email_sent" | "reply" | "bounce" | "note";
  payload: Record<string, unknown>;
  occurred_at?: string;
};

export type PassageStore = {
  listThreadsToCheck(options: { since: string; limit: number }): Promise<EnrollmentBundle[]>;
  listAwaitingPersonalization(options: { limit: number }): Promise<EnrollmentBundle[]>;
  listDue(options: { now: string; limit: number }): Promise<EnrollmentBundle[]>;
  /** Envois de la séquence depuis le début du jour de Paris — le plafond. */
  countSentSince(sequenceId: string, since: string): Promise<number>;
  /** Envois et rebonds de l'organisation sur la fenêtre de la garde. */
  countBounceWindow(orgId: string, since: string): Promise<{ sent: number; bounced: number }>;
  hasInteractionForMessage(gmailId: string): Promise<boolean>;
  saveEnrollment(id: string, patch: Partial<SequenceEnrollment>): Promise<void>;
  saveContact(id: string, patch: Partial<Contact>): Promise<void>;
  /** Fait avancer un prospect, jamais reculer : `contacted` n'écrase pas `meeting`. */
  advanceProspect(id: string, status: "contacted" | "replied"): Promise<void>;
  addInteraction(row: InteractionInsert): Promise<void>;
};

export type Mailer = {
  ownAddress: string;
  send(options: { mime: string; threadId: string | null }): Promise<{ id: string; threadId: string }>;
  readThread(threadId: string): Promise<ThreadMessage[]>;
};

export type ObservationInput = {
  prospect: Prospect;
  contact: Contact;
};

export type Observation = {
  observation: string | null;
  source: "site" | "ads" | "none";
};

export type Observer = (input: ObservationInput) => Promise<Observation>;

export type PassageReport = {
  checked: number;
  replies: number;
  bounces: number;
  autoReplies: number;
  personalized: number;
  sent: number;
  paused: number;
  skipped: number;
  guard: BounceGuard | null;
  /** Quand rien n'a pu partir pour une raison globale : boîte absente, garde. */
  blockedBy: string | null;
  errors: { enrollment: string; message: string }[];
};

/** Combien de fils on relit par passage, et sur quelle profondeur. */
export const THREAD_CHECK_LIMIT = 200;
export const THREAD_CHECK_DAYS = 30;
export const PERSONALIZE_LIMIT = 15;
export const SEND_LIMIT = 100;
/** La garde des rebonds regarde sept jours glissants. */
export const BOUNCE_WINDOW_DAYS = 7;

const DAY_MS = 86_400_000;

export async function runSequencesPassage(options: {
  store: PassageStore;
  mailer: Mailer | null;
  observer: Observer | null;
  /** L'origine des liens de désinscription : `https://…`, sans barre finale. */
  siteUrl: string;
  now: () => Date;
  uuid: () => string;
  /** Pour un passage à la demande, plus court que le passage programmé. */
  limits?: { threads?: number; personalize?: number; send?: number };
}): Promise<PassageReport> {
  const report: PassageReport = {
    checked: 0,
    replies: 0,
    bounces: 0,
    autoReplies: 0,
    personalized: 0,
    sent: 0,
    paused: 0,
    skipped: 0,
    guard: null,
    blockedBy: null,
    errors: [],
  };
  const { store, mailer, observer } = options;
  const now = options.now();

  // --- 1. Les fils ---------------------------------------------------------
  if (mailer) {
    const since = new Date(now.getTime() - THREAD_CHECK_DAYS * DAY_MS).toISOString();
    const bundles = await store.listThreadsToCheck({ since, limit: options.limits?.threads ?? THREAD_CHECK_LIMIT });
    for (const bundle of bundles) {
      try {
        await checkThread(bundle, { store, mailer, report, now });
        report.checked += 1;
      } catch (error) {
        report.errors.push({ enrollment: bundle.enrollment.id, message: describe(error) });
      }
    }
  }

  // --- 2. Les observations -------------------------------------------------
  if (observer) {
    const bundles = await store.listAwaitingPersonalization({ limit: options.limits?.personalize ?? PERSONALIZE_LIMIT });
    for (const bundle of bundles) {
      try {
        const found = await observer({ prospect: bundle.prospect, contact: bundle.contact });
        await store.saveEnrollment(bundle.enrollment.id, {
          personalization: {
            ...bundle.enrollment.personalization,
            observation: found.observation,
            observation_source: found.source,
            generated_at: now.toISOString(),
            ready: true,
          },
        });
        report.personalized += 1;
      } catch (error) {
        // Une observation qui échoue n'attend pas indéfiniment : l'inscription
        // est marquée prête sans observation, et c'est le gabarit qui décide
        // (repli, ou pause si la variable est requise).
        await store.saveEnrollment(bundle.enrollment.id, {
          personalization: {
            ...bundle.enrollment.personalization,
            observation: null,
            observation_source: "none",
            generated_at: now.toISOString(),
            ready: true,
            error: describe(error),
          },
        });
        report.errors.push({ enrollment: bundle.enrollment.id, message: describe(error) });
      }
    }
  }

  // --- 3. Les envois -------------------------------------------------------
  if (!mailer) {
    report.blockedBy = "Aucune boîte Gmail connectée.";
    return report;
  }

  const due = await store.listDue({ now: now.toISOString(), limit: options.limits?.send ?? SEND_LIMIT });
  if (due.length === 0) return report;

  const orgId = due[0]!.prospect.org_id;
  const windowStart = new Date(now.getTime() - BOUNCE_WINDOW_DAYS * DAY_MS).toISOString();
  const window = await store.countBounceWindow(orgId, windowStart);
  report.guard = evaluateBounceGuard(window.sent, window.bounced);
  if (report.guard.blocked) {
    report.blockedBy = `Garde des rebonds : ${window.bounced} rebond${window.bounced > 1 ? "s" : ""} sur ${window.sent} envois en sept jours (plus de 3 %). Rien ne part.`;
    report.skipped = due.length;
    return report;
  }

  const sentToday = new Map<string, number>();
  const dayStart = parisDayStart(now).toISOString();

  for (const bundle of due) {
    const { enrollment, sequence } = bundle;
    const settings = resolveSequenceSettings(sequence.settings);
    try {
      if (!sequence.is_active) {
        report.skipped += 1;
        continue;
      }
      if (!isInWindow(now, settings.send_window)) {
        report.skipped += 1;
        continue;
      }
      if (!sentToday.has(sequence.id)) {
        sentToday.set(sequence.id, await store.countSentSince(sequence.id, dayStart));
      }
      if ((sentToday.get(sequence.id) ?? 0) >= settings.daily_cap) {
        report.skipped += 1;
        continue;
      }

      const outcome = await sendNextStep(bundle, settings, { ...options, mailer, now });
      if (outcome === "sent") {
        report.sent += 1;
        sentToday.set(sequence.id, (sentToday.get(sequence.id) ?? 0) + 1);
        // Un envoi à la fois par contact, et un peu d'air entre deux : un
        // rythme de robot se voit dans les en-têtes de Gmail.
      } else if (outcome === "paused") {
        report.paused += 1;
      } else {
        report.skipped += 1;
      }
    } catch (error) {
      const message = describe(error);
      report.errors.push({ enrollment: enrollment.id, message });
      await store.saveEnrollment(enrollment.id, { last_error: message }).catch(() => undefined);
    }
  }

  return report;
}

// --- Les fils ----------------------------------------------------------------------

async function checkThread(
  bundle: EnrollmentBundle,
  context: { store: PassageStore; mailer: Mailer; report: PassageReport; now: Date },
): Promise<void> {
  const { enrollment, contact, prospect } = bundle;
  if (!enrollment.thread_id) return;
  const messages = await context.mailer.readThread(enrollment.thread_id);
  const verdicts = classifyThread(messages, {
    ownAddress: context.mailer.ownAddress,
    since: enrollment.last_sent_at ? new Date(enrollment.last_sent_at) : null,
  });

  for (const verdict of verdicts) {
    if (await context.store.hasInteractionForMessage(verdict.message.id)) continue;
    const base = {
      org_id: prospect.org_id,
      prospect_id: prospect.id,
      contact_id: contact.id,
      occurred_at: verdict.message.receivedAt.toISOString(),
    };
    const payload = {
      gmail_id: verdict.message.id,
      from: verdict.message.fromEmail,
      subject: verdict.message.subject,
      snippet: verdict.message.snippet.slice(0, 300),
      sequence_id: bundle.sequence.id,
      enrollment_id: enrollment.id,
    };

    if (verdict.kind === "bounce") {
      await context.store.addInteraction({ ...base, type: "bounce", payload });
      await context.store.saveContact(contact.id, { email_status: "invalid" });
      if (enrollment.status === "active") {
        await context.store.saveEnrollment(enrollment.id, {
          status: "paused",
          paused_reason: "Adresse rebondie : plus aucun envoi.",
          stopped_at: context.now.toISOString(),
          next_send_at: null,
        });
        enrollment.status = "paused";
      }
      context.report.bounces += 1;
      // Un rebond clôt le fil : ce qui suit serait du bruit.
      return;
    }

    if (verdict.kind === "auto_reply") {
      await context.store.addInteraction({
        ...base,
        type: "note",
        payload: { ...payload, text: `Réponse automatique reçue : ${verdict.message.subject ?? "sans objet"}` },
      });
      context.report.autoReplies += 1;
      continue;
    }

    // Une vraie réponse : la séquence s'arrête, le prospect avance.
    await context.store.addInteraction({ ...base, type: "reply", payload });
    await context.store.saveEnrollment(enrollment.id, {
      status: enrollment.status === "active" ? "stopped_on_reply" : enrollment.status,
      replied_at: verdict.message.receivedAt.toISOString(),
      next_send_at: null,
      stopped_at: enrollment.status === "active" ? context.now.toISOString() : enrollment.stopped_at,
    });
    await context.store.advanceProspect(prospect.id, "replied");
    context.report.replies += 1;
    return;
  }
}

// --- Les envois --------------------------------------------------------------------

type SendOutcome = "sent" | "paused" | "skipped";

async function sendNextStep(
  bundle: EnrollmentBundle,
  settings: SequenceSettings,
  context: { store: PassageStore; mailer: Mailer; siteUrl: string; now: Date; uuid: () => string },
): Promise<SendOutcome> {
  const { enrollment, contact, prospect, sequence } = bundle;
  const steps = [...bundle.steps].sort((a, b) => a.position - b.position);
  const step = steps[enrollment.current_step];
  if (!step) {
    await context.store.saveEnrollment(enrollment.id, {
      status: "completed",
      next_send_at: null,
      stopped_at: context.now.toISOString(),
    });
    return "skipped";
  }

  if (contact.opted_out) return "skipped"; // le trigger a déjà arrêté l'inscription
  if (!contact.email || contact.email_status !== "valid") {
    return pause(context.store, enrollment, "Adresse plus valide : l'envoi s'est arrêté.");
  }

  const observation = enrollment.personalization.observation?.trim() || null;
  if (settings.require_observation && !observation) {
    return pause(context.store, enrollment, "Observation manquante : à compléter avant l'envoi.");
  }

  const variables = buildTemplateContext({ contact, prospect, settings, observation });
  const subjectRendered = renderTemplate(step.subject_template, variables);
  const bodyRendered = renderTemplate(step.body_template, variables);
  const missing = [...new Set([...subjectRendered.missing, ...bodyRendered.missing])];
  if (missing.length > 0) {
    return pause(
      context.store,
      enrollment,
      `Variable${missing.length > 1 ? "s" : ""} sans valeur : ${missing.join(", ")}.`,
    );
  }

  const isFollowUp = enrollment.current_step > 0 && enrollment.thread_id !== null;
  const subject = isFollowUp ? replySubject(subjectRendered.text) : subjectRendered.text;
  const messageId = newMessageId(context.mailer.ownAddress, context.uuid());
  const email: OutreachEmail = {
    from: context.mailer.ownAddress,
    fromName: settings.sender_name,
    to: contact.email,
    subject,
    body: bodyRendered.text,
    messageId,
    inReplyTo: isFollowUp ? enrollment.last_message_id : null,
    unsubscribeUrl: `${context.siteUrl}/desinscription/${contact.unsubscribe_token}`,
  };

  const sent = await context.mailer.send({
    mime: buildOutreachMime(email),
    threadId: isFollowUp ? enrollment.thread_id : null,
  });

  const nextIndex = enrollment.current_step + 1;
  const next = steps[nextIndex];
  const nextDue = next
    ? stepDueAt(new Date(enrollment.enrolled_at), next.delay_days, settings.send_window)
    : null;
  // Une relance dont la date est déjà passée — inscription ancienne, séquence
  // réécrite — part au prochain créneau, pas dans la seconde qui suit.
  const nextSendAt = next
    ? (nextDue && nextDue.getTime() > context.now.getTime()
        ? nextDue
        : stepDueAt(context.now, 1, settings.send_window))
    : null;

  await context.store.addInteraction({
    org_id: prospect.org_id,
    prospect_id: prospect.id,
    contact_id: contact.id,
    type: "email_sent",
    payload: {
      subject,
      message_id: messageId,
      gmail_id: sent.id,
      sequence_id: sequence.id,
      enrollment_id: enrollment.id,
      step: step.position,
    },
    occurred_at: context.now.toISOString(),
  });
  await context.store.saveEnrollment(enrollment.id, {
    current_step: nextIndex,
    status: next ? "active" : "completed",
    next_send_at: nextSendAt ? nextSendAt.toISOString() : null,
    thread_id: sent.threadId,
    last_message_id: messageId,
    last_sent_at: context.now.toISOString(),
    last_error: null,
    paused_reason: null,
    stopped_at: next ? null : context.now.toISOString(),
  });
  await context.store.advanceProspect(prospect.id, "contacted");
  return "sent";
}

async function pause(
  store: PassageStore,
  enrollment: SequenceEnrollment,
  reason: string,
): Promise<SendOutcome> {
  await store.saveEnrollment(enrollment.id, { status: "paused", paused_reason: reason, next_send_at: null });
  return "paused";
}

/** Les variables d'un gabarit, pour un contact et sa société. */
export function buildTemplateContext(options: {
  contact: Pick<Contact, "first_name" | "last_name">;
  prospect: Pick<Prospect, "company_name" | "city" | "sector">;
  settings: Pick<SequenceSettings, "case_study_url" | "sender_name">;
  observation: string | null;
}): TemplateContext {
  return {
    prenom: greetingName(options.contact.first_name),
    nom: options.contact.last_name?.trim() || null,
    societe: options.prospect.company_name,
    ville: options.prospect.city,
    secteur: options.prospect.sector,
    observation: options.observation,
    lien_case_study: options.settings.case_study_url,
    expediteur: options.settings.sender_name,
  };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
