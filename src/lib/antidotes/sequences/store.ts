import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import type { Contact, Prospect, ProspectStatus, Sequence, SequenceEnrollment, SequenceStep } from "../types";
import type { EnrollmentBundle, InteractionInsert, PassageStore } from "./passage";

/**
 * La persistance du passage, en `service_role` : il tourne sur une machine
 * GitHub sans session, ou depuis la route « Passer maintenant » après une
 * garde d'owner. Chaque écriture teste l'erreur — un `data` nul sur une
 * colonne absente ferait un passage muet.
 *
 * Les jointures se font en mémoire, par lots : quelques centaines de lignes
 * par passage au plus, et les types écrits à la main ne décrivent pas les
 * relations qu'un `select` imbriqué demanderait.
 */

type Admin = SupabaseClient<Database>;

const fail = (step: string, error: { message: string } | null) => {
  if (error) throw new Error(`${step} : ${error.message}`);
};

/** L'ordre des statuts d'un prospect : on n'écrit jamais un statut antérieur. */
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

export async function loadBundles(admin: Admin, enrollments: SequenceEnrollment[]): Promise<EnrollmentBundle[]> {
  if (enrollments.length === 0) return [];
  const contactIds = [...new Set(enrollments.map((row) => row.contact_id))];
  const sequenceIds = [...new Set(enrollments.map((row) => row.sequence_id))];

  const [{ data: contactRows, error: contactError }, { data: sequenceRows, error: sequenceError }, { data: stepRows, error: stepError }] =
    await Promise.all([
      admin.from("antidotes_contacts").select("*").in("id", contactIds),
      admin.from("antidotes_sequences").select("*").in("id", sequenceIds),
      admin.from("antidotes_sequence_steps").select("*").in("sequence_id", sequenceIds).order("position"),
    ]);
  fail("contacts", contactError);
  fail("séquences", sequenceError);
  fail("étapes", stepError);

  const contacts = new Map(((contactRows ?? []) as unknown as Contact[]).map((row) => [row.id, row]));
  const prospectIds = [...new Set([...contacts.values()].map((row) => row.prospect_id))];
  const { data: prospectRows, error: prospectError } = prospectIds.length
    ? await admin.from("antidotes_prospects").select("*").in("id", prospectIds)
    : { data: [], error: null };
  fail("prospects", prospectError);
  const prospects = new Map(((prospectRows ?? []) as unknown as Prospect[]).map((row) => [row.id, row]));
  const sequences = new Map(((sequenceRows ?? []) as unknown as Sequence[]).map((row) => [row.id, row]));
  const steps = new Map<string, SequenceStep[]>();
  for (const step of (stepRows ?? []) as unknown as SequenceStep[]) {
    steps.set(step.sequence_id, [...(steps.get(step.sequence_id) ?? []), step]);
  }

  const bundles: EnrollmentBundle[] = [];
  for (const enrollment of enrollments) {
    const contact = contacts.get(enrollment.contact_id);
    const sequence = sequences.get(enrollment.sequence_id);
    const prospect = contact ? prospects.get(contact.prospect_id) : undefined;
    if (!contact || !sequence || !prospect) continue;
    bundles.push({ enrollment, contact, prospect, sequence, steps: steps.get(sequence.id) ?? [] });
  }
  return bundles;
}

export function createPassageStore(admin: Admin): PassageStore {
  return {
    async listThreadsToCheck({ since, limit }) {
      const { data, error } = await admin
        .from("antidotes_sequence_enrollments")
        .select("*")
        .not("thread_id", "is", null)
        .is("replied_at", null)
        .in("status", ["active", "completed"])
        .gte("last_sent_at", since)
        .order("last_sent_at", { ascending: false })
        .limit(limit);
      fail("fils à relever", error);
      return loadBundles(admin, (data ?? []) as unknown as SequenceEnrollment[]);
    },

    async listAwaitingPersonalization({ limit }) {
      const { data, error } = await admin
        .from("antidotes_sequence_enrollments")
        .select("*")
        .eq("status", "active")
        .eq("channel", "email")
        .is("personalization->>ready", null)
        .order("enrolled_at", { ascending: true })
        .limit(limit);
      fail("inscriptions à préparer", error);
      return loadBundles(admin, (data ?? []) as unknown as SequenceEnrollment[]);
    },

    async listDue({ now, limit }) {
      const { data, error } = await admin
        .from("antidotes_sequence_enrollments")
        .select("*")
        .eq("status", "active")
        .eq("channel", "email")
        .lte("next_send_at", now)
        .order("next_send_at", { ascending: true })
        .limit(limit);
      fail("inscriptions dues", error);
      return loadBundles(admin, (data ?? []) as unknown as SequenceEnrollment[]);
    },

    async countSentSince(sequenceId, since) {
      const { count, error } = await admin
        .from("antidotes_interactions")
        .select("id", { count: "exact", head: true })
        .eq("type", "email_sent")
        .eq("payload->>sequence_id", sequenceId)
        .gte("occurred_at", since);
      fail("envois du jour", error);
      return count ?? 0;
    },

    async countBounceWindow(orgId, since) {
      const [sent, bounced] = await Promise.all([
        admin
          .from("antidotes_interactions")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId)
          .eq("type", "email_sent")
          .gte("occurred_at", since),
        admin
          .from("antidotes_interactions")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId)
          .eq("type", "bounce")
          .gte("occurred_at", since),
      ]);
      fail("garde des rebonds", sent.error);
      fail("garde des rebonds", bounced.error);
      return { sent: sent.count ?? 0, bounced: bounced.count ?? 0 };
    },

    async hasInteractionForMessage(gmailId) {
      const { data, error } = await admin
        .from("antidotes_interactions")
        .select("id")
        .eq("payload->>gmail_id", gmailId)
        .limit(1);
      fail("journal", error);
      return (data ?? []).length > 0;
    },

    async saveEnrollment(id, patch) {
      const { error } = await admin
        .from("antidotes_sequence_enrollments")
        .update(patch as never)
        .eq("id", id);
      fail("inscription", error);
    },

    async saveContact(id, patch) {
      const { error } = await admin.from("antidotes_contacts").update(patch as never).eq("id", id);
      fail("contact", error);
    },

    async advanceProspect(id, status) {
      const { data, error } = await admin
        .from("antidotes_prospects")
        .select("status")
        .eq("id", id)
        .maybeSingle();
      fail("prospect", error);
      const current = (data as unknown as { status: ProspectStatus } | null)?.status;
      if (!current || STATUS_RANK[current] >= STATUS_RANK[status]) return;
      const { error: updateError } = await admin
        .from("antidotes_prospects")
        .update({ status } as never)
        .eq("id", id);
      fail("prospect", updateError);
    },

    async addInteraction(row: InteractionInsert) {
      const { error } = await admin.from("antidotes_interactions").insert(row as never);
      fail("journal", error);
    },
  };
}
