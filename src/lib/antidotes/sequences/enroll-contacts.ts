import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import type { Contact, Prospect, Sequence, SequenceStep } from "../types";
import { contactDisplayName } from "../types";
import { resolveSequenceSettings } from "./defaults";
import { decideEnrollment, linkedinTaskKey, linkedinTaskTitle } from "./enroll";
import { parisDay } from "./schedule";

/**
 * Inscrire des prospects à une séquence — le geste du tableau et du panneau.
 *
 * Un prospect s'inscrit par son **contact principal** ; sans contact
 * principal, le premier contact joignable. Le canal se fige à l'inscription
 * (`decideEnrollment`) : email pour une adresse valide, piste LinkedIn pour
 * une adresse risquée — et la piste LinkedIn pose aussitôt sa tâche dans
 * « Mon travail », idempotente par inscription.
 *
 * Tout ce qui est écarté est compté par raison : l'écran dit « 2 écartés,
 * adresse non vérifiée », jamais « 3 inscrits » quand on en a demandé cinq.
 */

export type EnrollOutcome = {
  enrolled: number;
  linkedin: number;
  already: number;
  skipped: Record<string, number>;
};

export async function enrollProspects(options: {
  supabase: SupabaseClient<Database>;
  orgId: string;
  sequenceId: string;
  prospectIds: string[];
  siteUrl: string;
  now: Date;
}): Promise<EnrollOutcome> {
  const { supabase, orgId } = options;
  const outcome: EnrollOutcome = { enrolled: 0, linkedin: 0, already: 0, skipped: {} };
  const skip = (reason: string) => {
    outcome.skipped[reason] = (outcome.skipped[reason] ?? 0) + 1;
  };

  const [{ data: sequenceRow, error: sequenceError }, { data: stepRows, error: stepError }] = await Promise.all([
    supabase.from("antidotes_sequences").select("*").eq("org_id", orgId).eq("id", options.sequenceId).maybeSingle(),
    supabase.from("antidotes_sequence_steps").select("*").eq("org_id", orgId).eq("sequence_id", options.sequenceId),
  ]);
  if (sequenceError) throw new Error(sequenceError.message);
  if (stepError) throw new Error(stepError.message);
  const sequence = sequenceRow as unknown as Sequence | null;
  if (!sequence) throw new Error("Séquence introuvable.");
  const steps = (stepRows ?? []) as unknown as SequenceStep[];
  const settings = resolveSequenceSettings(sequence.settings);

  const ids = [...new Set(options.prospectIds)];
  const [{ data: prospectRows, error: prospectError }, { data: contactRows, error: contactError }] = await Promise.all([
    supabase.from("antidotes_prospects").select("id, company_name").eq("org_id", orgId).in("id", ids),
    supabase
      .from("antidotes_contacts")
      .select("*")
      .eq("org_id", orgId)
      .in("prospect_id", ids)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true }),
  ]);
  if (prospectError) throw new Error(prospectError.message);
  if (contactError) throw new Error(contactError.message);
  const prospects = new Map(
    ((prospectRows ?? []) as unknown as Pick<Prospect, "id" | "company_name">[]).map((row) => [row.id, row]),
  );
  const contactsByProspect = new Map<string, Contact[]>();
  for (const contact of (contactRows ?? []) as unknown as Contact[]) {
    contactsByProspect.set(contact.prospect_id, [...(contactsByProspect.get(contact.prospect_id) ?? []), contact]);
  }

  for (const prospectId of ids) {
    const prospect = prospects.get(prospectId);
    if (!prospect) continue;
    const contacts = contactsByProspect.get(prospectId) ?? [];
    const contact =
      contacts.find((entry) => entry.is_primary) ??
      contacts.find((entry) => entry.outreach_channel !== "none") ??
      contacts[0];
    if (!contact) {
      skip("sans contact");
      continue;
    }

    const decision = decideEnrollment({ contact, steps, window: settings.send_window, now: options.now });
    if (!decision.ok) {
      skip(decision.reason);
      continue;
    }

    const { data: inserted, error } = await supabase
      .from("antidotes_sequence_enrollments")
      .upsert(
        {
          org_id: orgId,
          sequence_id: sequence.id,
          contact_id: contact.id,
          channel: decision.channel,
          next_send_at: decision.next_send_at,
          status: "active",
        } as never,
        { onConflict: "sequence_id,contact_id", ignoreDuplicates: true },
      )
      .select("id");
    if (error) {
      // Le trigger de désinscription refuse en `check_violation` : c'est un
      // écart, pas une panne.
      skip(error.code === "23514" ? "contact désinscrit" : "refusé par la base");
      continue;
    }
    const row = (inserted ?? [])[0] as unknown as { id: string } | undefined;
    if (!row) {
      outcome.already += 1;
      continue;
    }

    outcome.enrolled += 1;
    if (decision.channel === "linkedin") {
      outcome.linkedin += 1;
      const { error: taskError } = await supabase.from("work_tasks").upsert(
        {
          org_id: orgId,
          title: linkedinTaskTitle({
            contactName: contactDisplayName(contact),
            companyName: prospect.company_name,
          }),
          source: "antidotes",
          status: "pending",
          due_date: parisDay(options.now),
          dedupe_key: linkedinTaskKey(row.id),
          source_url: contact.linkedin_url ?? `${options.siteUrl}/antidotes/outbound/sequences/${sequence.id}`,
          source_label: contact.linkedin_url ? "Profil LinkedIn" : "Séquence",
        } as never,
        { onConflict: "org_id,dedupe_key", ignoreDuplicates: true },
      );
      if (taskError) throw new Error(`Tâche LinkedIn : ${taskError.message}`);
    }
  }

  return outcome;
}

/** Une phrase pour le toast : « 3 inscrits (1 piste LinkedIn) · 2 écartés : adresse non vérifiée ». */
export function describeEnrollOutcome(outcome: EnrollOutcome): string {
  const parts: string[] = [];
  parts.push(
    outcome.enrolled === 0
      ? "Aucune inscription"
      : `${outcome.enrolled} inscrit${outcome.enrolled > 1 ? "s" : ""}${
          outcome.linkedin > 0 ? ` (${outcome.linkedin} piste${outcome.linkedin > 1 ? "s" : ""} LinkedIn)` : ""
        }`,
  );
  if (outcome.already > 0) parts.push(`${outcome.already} déjà inscrit${outcome.already > 1 ? "s" : ""}`);
  const skipped = Object.entries(outcome.skipped);
  if (skipped.length > 0) {
    const total = skipped.reduce((sum, [, count]) => sum + count, 0);
    parts.push(
      `${total} écarté${total > 1 ? "s" : ""} : ${skipped.map(([reason, count]) => (count > 1 ? `${reason} ×${count}` : reason)).join(", ")}`,
    );
  }
  return `${parts.join(" · ")}.`;
}
