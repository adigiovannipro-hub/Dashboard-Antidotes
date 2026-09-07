"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { DEFAULT_STEPS, resolveSequenceSettings } from "@/lib/antidotes/sequences/defaults";
import { linkedinTaskKey } from "@/lib/antidotes/sequences/enroll";
import { describeEnrollOutcome, enrollProspects } from "@/lib/antidotes/sequences/enroll-contacts";
import { runSequencesPassageNow } from "@/lib/antidotes/sequences/run-passage";
import { nextWindowStart } from "@/lib/antidotes/sequences/schedule";
import type {
  Contact,
  ProspectStatus,
  Sequence,
  SequenceEnrollment,
} from "@/lib/antidotes/types";
import { getViewer } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Les écritures des Séquences : créer, régler, inscrire, piloter une
 * inscription, clore une piste LinkedIn, passer maintenant. Même posture que
 * le pipeline — garde d'owner, `safeParse` en entrée, union discriminée en
 * sortie, `revalidatePath` — et le `where` de tenant explicite partout.
 */

export type SequencesResult =
  | { ok: true; message?: string; id?: string }
  | { ok: false; error: string };

const SEQUENCES_PATH = "/antidotes/outbound/sequences";
const PIPELINE_PATH = "/antidotes/outbound/pipeline";
const HOME_PATH = "/";

async function guardOwner(): Promise<{ orgId: string }> {
  const viewer = await getViewer();
  if (!viewer) throw new Error("Session expirée.");
  const orgId = viewer.ownedOrgIds[0];
  if (!viewer.isOwner || !orgId) throw new Error("Action indisponible.");
  return { orgId };
}

function fail(error: unknown): SequencesResult {
  return { ok: false, error: (error as Error).message };
}

function firstIssue(error: z.ZodError, fallback: string): SequencesResult {
  return { ok: false, error: error.issues[0]?.message ?? fallback };
}

const formValue = (formData: FormData, key: string): string => String(formData.get(key) ?? "");

function revalidateSequences(sequenceId?: string) {
  revalidatePath(SEQUENCES_PATH);
  if (sequenceId) revalidatePath(`${SEQUENCES_PATH}/${sequenceId}`);
  revalidatePath(PIPELINE_PATH);
  revalidatePath(HOME_PATH);
}

/** L'ordre des statuts : une action ne fait jamais reculer un prospect. */
const STATUS_RANK: Record<ProspectStatus, number> = {
  to_qualify: 0,
  qualified: 1,
  no_contact_found: 1,
  contacted: 2,
  replied: 3,
  meeting: 4,
  won: 5,
  lost: 5,
};

// --- Créer et régler ---------------------------------------------------------------

const createInput = z.object({
  name: z.string().trim().min(2, "Un nom d'au moins deux caractères.").max(120),
});

export async function createSequence(
  _previous: SequencesResult | null,
  formData: FormData,
): Promise<SequencesResult> {
  const parsed = createInput.safeParse({ name: formValue(formData, "name") });
  if (!parsed.success) return firstIssue(parsed.error, "Saisie invalide.");

  try {
    const { orgId } = await guardOwner();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("antidotes_sequences")
      .insert({ org_id: orgId, name: parsed.data.name, settings: {} } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const id = (data as unknown as { id: string }).id;

    const { error: stepError } = await supabase.from("antidotes_sequence_steps").insert(
      DEFAULT_STEPS.map((step) => ({ ...step, org_id: orgId, sequence_id: id })) as never,
    );
    if (stepError) throw new Error(stepError.message);

    revalidateSequences(id);
    return { ok: true, id, message: "Séquence créée." };
  } catch (error) {
    return fail(error);
  }
}

const hour = z.coerce.number().int().min(0).max(24);
const saveInput = z.object({
  sequenceId: z.uuid(),
  name: z.string().trim().min(2, "Un nom d'au moins deux caractères.").max(120),
  description: z.string().trim().max(500),
  isActive: z.boolean(),
  caseStudyUrl: z.union([z.literal(""), z.url("Le lien du case study doit être une URL complète.")]),
  dailyCap: z.coerce.number().int().min(1, "Au moins un envoi par jour.").max(500),
  senderName: z.string().trim().max(120),
  windowDays: z.array(z.coerce.number().int().min(1).max(7)),
  startHour: hour,
  endHour: hour,
  requireObservation: z.boolean(),
  linkedinMessage: z.string().trim().max(2000),
  steps: z
    .array(
      z.object({
        position: z.number().int().min(1),
        delay_days: z.coerce.number().int().min(0, "Un délai ne peut pas être négatif.").max(365),
        subject_template: z.string().trim().min(1, "Chaque étape a un objet.").max(200),
        body_template: z.string().trim().min(1, "Chaque étape a un corps.").max(5000),
      }),
    )
    .min(1, "Au moins une étape.")
    .max(8),
});

export async function saveSequence(
  _previous: SequencesResult | null,
  formData: FormData,
): Promise<SequencesResult> {
  const stepCount = Number(formValue(formData, "stepCount")) || 0;
  const steps = Array.from({ length: Math.min(Math.max(stepCount, 0), 8) }, (_, index) => ({
    position: index + 1,
    delay_days: formValue(formData, `step_${index + 1}_delay`),
    subject_template: formValue(formData, `step_${index + 1}_subject`),
    body_template: formValue(formData, `step_${index + 1}_body`),
  }));

  const parsed = saveInput.safeParse({
    sequenceId: formValue(formData, "sequenceId"),
    name: formValue(formData, "name"),
    description: formValue(formData, "description"),
    isActive: formData.get("isActive") === "on",
    caseStudyUrl: formValue(formData, "caseStudyUrl").trim(),
    dailyCap: formValue(formData, "dailyCap"),
    senderName: formValue(formData, "senderName"),
    windowDays: formData.getAll("windowDay").map(String),
    startHour: formValue(formData, "startHour"),
    endHour: formValue(formData, "endHour"),
    requireObservation: formData.get("requireObservation") === "on",
    linkedinMessage: formValue(formData, "linkedinMessage"),
    steps,
  });
  if (!parsed.success) return firstIssue(parsed.error, "Saisie invalide.");
  const input = parsed.data;
  if (input.startHour >= input.endHour) {
    return { ok: false, error: "La fenêtre d'envoi doit finir après son début." };
  }
  for (let index = 1; index < input.steps.length; index += 1) {
    if (input.steps[index]!.delay_days < input.steps[index - 1]!.delay_days) {
      return { ok: false, error: `L'étape ${index + 1} ne peut pas partir avant l'étape ${index}.` };
    }
  }

  try {
    const { orgId } = await guardOwner();
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("antidotes_sequences")
      .select("settings")
      .eq("org_id", orgId)
      .eq("id", input.sequenceId)
      .maybeSingle();
    if (!existing) throw new Error("Séquence introuvable.");
    const current = resolveSequenceSettings((existing as unknown as Sequence).settings);

    const { error } = await supabase
      .from("antidotes_sequences")
      .update({
        name: input.name,
        description: input.description || null,
        is_active: input.isActive,
        settings: {
          ...current,
          case_study_url: input.caseStudyUrl || null,
          daily_cap: input.dailyCap,
          send_window: {
            days: [...new Set(input.windowDays)].sort(),
            start_hour: input.startHour,
            end_hour: input.endHour,
          },
          sender_name: input.senderName || null,
          linkedin_message: input.linkedinMessage || current.linkedin_message,
          require_observation: input.requireObservation,
        },
      } as never)
      .eq("org_id", orgId)
      .eq("id", input.sequenceId);
    if (error) throw new Error(error.message);

    const { error: stepError } = await supabase.from("antidotes_sequence_steps").upsert(
      input.steps.map((step) => ({ ...step, org_id: orgId, sequence_id: input.sequenceId })) as never,
      { onConflict: "sequence_id,position" },
    );
    if (stepError) throw new Error(stepError.message);
    const { error: pruneError } = await supabase
      .from("antidotes_sequence_steps")
      .delete()
      .eq("org_id", orgId)
      .eq("sequence_id", input.sequenceId)
      .gt("position", input.steps.length);
    if (pruneError) throw new Error(pruneError.message);

    revalidateSequences(input.sequenceId);
    return { ok: true, message: "Séquence enregistrée." };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteSequence(input: { sequenceId: string }): Promise<SequencesResult> {
  const parsed = z.object({ sequenceId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Séquence invalide." };
  try {
    const { orgId } = await guardOwner();
    const supabase = await createClient();
    const { count } = await supabase
      .from("antidotes_sequence_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("sequence_id", parsed.data.sequenceId)
      .not("last_sent_at", "is", null);
    if ((count ?? 0) > 0) {
      throw new Error("Cette séquence a déjà envoyé des emails : désactivez-la plutôt, l'historique reste lisible.");
    }
    const { error } = await supabase
      .from("antidotes_sequences")
      .delete()
      .eq("org_id", orgId)
      .eq("id", parsed.data.sequenceId);
    if (error) throw new Error(error.message);
    revalidateSequences();
    return { ok: true, message: "Séquence supprimée." };
  } catch (error) {
    return fail(error);
  }
}

// --- Inscrire ----------------------------------------------------------------------

export async function enrollInSequence(input: {
  sequenceId: string;
  prospectIds: string[];
}): Promise<SequencesResult> {
  const parsed = z
    .object({ sequenceId: z.uuid(), prospectIds: z.array(z.uuid()).min(1).max(500) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Sélection invalide." };

  try {
    const { orgId } = await guardOwner();
    const supabase = await createClient();
    const outcome = await enrollProspects({
      supabase,
      orgId,
      sequenceId: parsed.data.sequenceId,
      prospectIds: parsed.data.prospectIds,
      siteUrl: publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, ""),
      now: new Date(),
    });
    revalidateSequences(parsed.data.sequenceId);
    return { ok: true, message: describeEnrollOutcome(outcome) };
  } catch (error) {
    return fail(error);
  }
}

// --- Piloter une inscription -------------------------------------------------------

async function loadEnrollment(orgId: string, enrollmentId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("antidotes_sequence_enrollments")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", enrollmentId)
    .maybeSingle();
  const enrollment = data as unknown as SequenceEnrollment | null;
  if (!enrollment) throw new Error("Inscription introuvable.");
  const [{ data: contactRow }, { data: sequenceRow }] = await Promise.all([
    supabase.from("antidotes_contacts").select("*").eq("org_id", orgId).eq("id", enrollment.contact_id).maybeSingle(),
    supabase.from("antidotes_sequences").select("*").eq("org_id", orgId).eq("id", enrollment.sequence_id).maybeSingle(),
  ]);
  const contact = contactRow as unknown as Contact | null;
  const sequence = sequenceRow as unknown as Sequence | null;
  if (!contact || !sequence) throw new Error("Inscription orpheline.");
  return { supabase, enrollment, contact, sequence };
}

async function markTaskDone(orgId: string, enrollmentId: string) {
  const supabase = await createClient();
  await supabase
    .from("work_tasks")
    .update({ status: "done", done_at: new Date().toISOString() } as never)
    .eq("org_id", orgId)
    .eq("dedupe_key", linkedinTaskKey(enrollmentId))
    .eq("status", "pending");
}

async function advanceProspect(orgId: string, prospectId: string, status: "contacted" | "replied") {
  const supabase = await createClient();
  const { data } = await supabase
    .from("antidotes_prospects")
    .select("status")
    .eq("org_id", orgId)
    .eq("id", prospectId)
    .maybeSingle();
  const current = (data as unknown as { status: ProspectStatus } | null)?.status;
  if (!current || STATUS_RANK[current] >= STATUS_RANK[status]) return;
  await supabase.from("antidotes_prospects").update({ status } as never).eq("org_id", orgId).eq("id", prospectId);
}

export async function setEnrollmentStatus(input: {
  enrollmentId: string;
  action: "pause" | "resume" | "stop";
}): Promise<SequencesResult> {
  const parsed = z
    .object({ enrollmentId: z.uuid(), action: z.enum(["pause", "resume", "stop"]) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Inscription invalide." };

  try {
    const { orgId } = await guardOwner();
    const { supabase, enrollment, contact, sequence } = await loadEnrollment(orgId, parsed.data.enrollmentId);
    const now = new Date();
    let patch: Partial<SequenceEnrollment>;
    let message: string;

    if (parsed.data.action === "pause") {
      if (enrollment.status !== "active") throw new Error("Cette inscription n'est pas en cours.");
      patch = { status: "paused", paused_reason: "Mise en pause à la main.", next_send_at: null };
      message = "Inscription en pause.";
    } else if (parsed.data.action === "resume") {
      if (enrollment.status !== "paused") throw new Error("Cette inscription n'est pas en pause.");
      if (contact.opted_out) throw new Error("Ce contact est désinscrit.");
      if (enrollment.channel === "email" && contact.email_status !== "valid") {
        throw new Error("L'adresse de ce contact n'est plus valide : rien ne peut repartir.");
      }
      const settings = resolveSequenceSettings(sequence.settings);
      const next = enrollment.channel === "email" ? nextWindowStart(now, settings.send_window) : null;
      if (enrollment.channel === "email" && !next) throw new Error("La fenêtre d'envoi est fermée en permanence.");
      patch = {
        status: "active",
        paused_reason: null,
        last_error: null,
        next_send_at: next ? next.toISOString() : null,
      };
      message = "Inscription reprise.";
    } else {
      if (enrollment.status !== "active" && enrollment.status !== "paused") {
        throw new Error("Cette inscription est déjà terminée.");
      }
      patch = { status: "completed", stopped_at: now.toISOString(), next_send_at: null };
      message = "Inscription arrêtée.";
      if (enrollment.channel === "linkedin") await markTaskDone(orgId, enrollment.id);
    }

    const { error } = await supabase
      .from("antidotes_sequence_enrollments")
      .update(patch as never)
      .eq("org_id", orgId)
      .eq("id", enrollment.id);
    if (error) throw new Error(error.message);

    revalidateSequences(enrollment.sequence_id);
    return { ok: true, message };
  } catch (error) {
    return fail(error);
  }
}

export async function updateObservation(input: {
  enrollmentId: string;
  observation: string;
}): Promise<SequencesResult> {
  const parsed = z
    .object({ enrollmentId: z.uuid(), observation: z.string().trim().max(400) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Observation invalide (400 caractères au plus)." };

  try {
    const { orgId } = await guardOwner();
    const { supabase, enrollment, contact, sequence } = await loadEnrollment(orgId, parsed.data.enrollmentId);
    const observation = parsed.data.observation || null;
    const patch: Partial<SequenceEnrollment> = {
      personalization: {
        ...enrollment.personalization,
        observation,
        observation_source: observation ? "manual" : "none",
        generated_at: new Date().toISOString(),
        ready: true,
        error: undefined,
      },
    };
    // Une inscription en pause faute d'observation ou de variable repart
    // d'elle-même : c'est précisément ce qu'on vient de corriger.
    if (
      enrollment.status === "paused" &&
      enrollment.channel === "email" &&
      contact.email_status === "valid" &&
      !contact.opted_out &&
      /^(Observation manquante|Variables? sans valeur)/.test(enrollment.paused_reason ?? "")
    ) {
      const next = nextWindowStart(new Date(), resolveSequenceSettings(sequence.settings).send_window);
      patch.status = "active";
      patch.paused_reason = null;
      patch.next_send_at = next ? next.toISOString() : null;
    }
    const { error } = await supabase
      .from("antidotes_sequence_enrollments")
      .update(patch as never)
      .eq("org_id", orgId)
      .eq("id", enrollment.id);
    if (error) throw new Error(error.message);
    revalidateSequences(enrollment.sequence_id);
    return { ok: true, message: "Observation enregistrée." };
  } catch (error) {
    return fail(error);
  }
}

export async function completeLinkedinStep(input: {
  enrollmentId: string;
  outcome: "done" | "replied";
  message?: string;
}): Promise<SequencesResult> {
  const parsed = z
    .object({
      enrollmentId: z.uuid(),
      outcome: z.enum(["done", "replied"]),
      message: z.string().trim().max(2000).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };

  try {
    const { orgId } = await guardOwner();
    const { supabase, enrollment, contact, sequence } = await loadEnrollment(orgId, parsed.data.enrollmentId);
    if (enrollment.channel !== "linkedin") throw new Error("Cette inscription n'est pas une piste LinkedIn.");
    if (enrollment.status !== "active") throw new Error("Cette piste est déjà close.");
    const now = new Date().toISOString();
    const base = {
      org_id: orgId,
      prospect_id: contact.prospect_id,
      contact_id: contact.id,
      occurred_at: now,
    };

    const rows = [
      {
        ...base,
        type: "linkedin_dm",
        payload: {
          text: parsed.data.message || "Message envoyé sur LinkedIn.",
          sequence_id: sequence.id,
          enrollment_id: enrollment.id,
        },
      },
      ...(parsed.data.outcome === "replied"
        ? [
            {
              ...base,
              type: "reply",
              payload: { text: "Réponse reçue sur LinkedIn.", sequence_id: sequence.id, enrollment_id: enrollment.id },
            },
          ]
        : []),
    ];
    const { error } = await supabase.from("antidotes_interactions").insert(rows as never);
    if (error) throw new Error(error.message);

    const { error: updateError } = await supabase
      .from("antidotes_sequence_enrollments")
      .update(
        (parsed.data.outcome === "replied"
          ? { status: "stopped_on_reply", replied_at: now, stopped_at: now, last_sent_at: now, current_step: 1 }
          : { status: "completed", stopped_at: now, last_sent_at: now, current_step: 1 }) as never,
      )
      .eq("org_id", orgId)
      .eq("id", enrollment.id);
    if (updateError) throw new Error(updateError.message);

    await markTaskDone(orgId, enrollment.id);
    await advanceProspect(orgId, contact.prospect_id, parsed.data.outcome === "replied" ? "replied" : "contacted");

    revalidateSequences(sequence.id);
    return { ok: true, message: parsed.data.outcome === "replied" ? "Réponse notée." : "Piste LinkedIn close." };
  } catch (error) {
    return fail(error);
  }
}

// --- Passer maintenant -------------------------------------------------------------

export async function runSequencesNow(): Promise<SequencesResult> {
  try {
    await guardOwner();
    const report = await runSequencesPassageNow({ limits: { threads: 40, personalize: 5, send: 25 } });
    revalidateSequences();
    const parts = [
      `${report.sent} envoi${report.sent > 1 ? "s" : ""}`,
      `${report.replies} réponse${report.replies > 1 ? "s" : ""}`,
      ...(report.bounces > 0 ? [`${report.bounces} rebond${report.bounces > 1 ? "s" : ""}`] : []),
      ...(report.personalized > 0 ? [`${report.personalized} observation${report.personalized > 1 ? "s" : ""}`] : []),
      ...(report.paused > 0 ? [`${report.paused} en pause`] : []),
    ];
    const message = report.blockedBy ? `${parts.join(", ")}. ${report.blockedBy}` : `${parts.join(", ")}.`;
    return report.errors.length > 0
      ? { ok: true, message: `${message} ${report.errors.length} erreur${report.errors.length > 1 ? "s" : ""} : ${report.errors[0]!.message}` }
      : { ok: true, message };
  } catch (error) {
    return fail(error);
  }
}
