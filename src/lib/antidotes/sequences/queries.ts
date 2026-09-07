import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Contact, Prospect, Sequence, SequenceEnrollment, SequenceStep } from "../types";
import { resolveSequenceSettings, type SequenceSettings } from "./defaults";
import { computeSequenceCounts, evaluateBounceGuard, type BounceGuard, type SequenceCounts } from "./stats";

/**
 * Les lectures des écrans Séquences. Le `where` de tenant est explicite
 * partout, même là où la RLS le porte : en accès ouvert elle ne protège
 * rien, et un code qui s'appuie sur elle seule est faux aujourd'hui.
 */

export type SequenceSummary = {
  sequence: Sequence;
  settings: SequenceSettings;
  stepCount: number;
  counts: SequenceCounts;
  /** Le prochain envoi planifié, toutes inscriptions confondues. */
  nextSendAt: string | null;
};

type InteractionLite = { type: string; payload: { sequence_id?: string } };

/** Les journaux d'envoi, de réponse et de rebond de l'organisation, par séquence. */
async function interactionsBySequence(orgId: string): Promise<Map<string, InteractionLite[]>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("antidotes_interactions")
    .select("type, payload")
    .eq("org_id", orgId)
    .in("type", ["email_sent", "reply", "bounce"])
    .order("occurred_at", { ascending: false })
    .limit(5000);
  const map = new Map<string, InteractionLite[]>();
  for (const row of (data ?? []) as unknown as InteractionLite[]) {
    const key = row.payload?.sequence_id;
    if (!key) continue;
    map.set(key, [...(map.get(key) ?? []), row]);
  }
  return map;
}

export async function listSequenceSummaries(options: { orgId: string }): Promise<SequenceSummary[]> {
  const supabase = await createClient();
  const [{ data: sequences }, { data: steps }, { data: enrollments }, interactions] = await Promise.all([
    supabase
      .from("antidotes_sequences")
      .select("*")
      .eq("org_id", options.orgId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("antidotes_sequence_steps").select("sequence_id").eq("org_id", options.orgId).limit(2000),
    supabase
      .from("antidotes_sequence_enrollments")
      .select("sequence_id, status, channel, last_sent_at, next_send_at")
      .eq("org_id", options.orgId)
      .limit(10000),
    interactionsBySequence(options.orgId),
  ]);

  const stepCount = new Map<string, number>();
  for (const step of (steps ?? []) as unknown as { sequence_id: string }[]) {
    stepCount.set(step.sequence_id, (stepCount.get(step.sequence_id) ?? 0) + 1);
  }
  type Lite = Pick<SequenceEnrollment, "sequence_id" | "status" | "channel" | "last_sent_at" | "next_send_at">;
  const bySequence = new Map<string, Lite[]>();
  for (const row of (enrollments ?? []) as unknown as Lite[]) {
    bySequence.set(row.sequence_id, [...(bySequence.get(row.sequence_id) ?? []), row]);
  }

  return ((sequences ?? []) as unknown as Sequence[]).map((sequence) => {
    const rows = bySequence.get(sequence.id) ?? [];
    const contacted = rows.filter((row) => row.last_sent_at !== null).length;
    const next = rows
      .filter((row) => row.status === "active" && row.next_send_at)
      .map((row) => row.next_send_at!)
      .sort()[0];
    return {
      sequence,
      settings: resolveSequenceSettings(sequence.settings),
      stepCount: stepCount.get(sequence.id) ?? 0,
      counts: computeSequenceCounts(rows, interactions.get(sequence.id) ?? [], contacted),
      nextSendAt: next ?? null,
    };
  });
}

export type SequenceOption = { id: string; name: string; is_active: boolean };

export async function listSequenceOptions(options: { orgId: string }): Promise<SequenceOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("antidotes_sequences")
    .select("id, name, is_active")
    .eq("org_id", options.orgId)
    .order("name")
    .limit(200);
  return (data ?? []) as unknown as SequenceOption[];
}

export type ProspectLite = Pick<Prospect, "id" | "company_name" | "city" | "sector" | "status" | "website" | "ads_active">;

export type EnrollmentRow = {
  enrollment: SequenceEnrollment;
  contact: Contact;
  prospect: ProspectLite;
};

export type SequenceDetail = {
  sequence: Sequence;
  settings: SequenceSettings;
  steps: SequenceStep[];
  enrollments: EnrollmentRow[];
  counts: SequenceCounts;
};

async function loadEnrollmentRows(orgId: string, enrollments: SequenceEnrollment[]): Promise<EnrollmentRow[]> {
  if (enrollments.length === 0) return [];
  const supabase = await createClient();
  const contactIds = [...new Set(enrollments.map((row) => row.contact_id))];
  const { data: contactRows } = await supabase
    .from("antidotes_contacts")
    .select("*")
    .eq("org_id", orgId)
    .in("id", contactIds);
  const contacts = new Map(((contactRows ?? []) as unknown as Contact[]).map((row) => [row.id, row]));
  const prospectIds = [...new Set([...contacts.values()].map((row) => row.prospect_id))];
  const { data: prospectRows } = prospectIds.length
    ? await supabase
        .from("antidotes_prospects")
        .select("id, company_name, city, sector, status, website, ads_active")
        .eq("org_id", orgId)
        .in("id", prospectIds)
    : { data: [] };
  const prospects = new Map(((prospectRows ?? []) as unknown as ProspectLite[]).map((row) => [row.id, row]));

  const rows: EnrollmentRow[] = [];
  for (const enrollment of enrollments) {
    const contact = contacts.get(enrollment.contact_id);
    const prospect = contact ? prospects.get(contact.prospect_id) : undefined;
    if (!contact || !prospect) continue;
    rows.push({ enrollment, contact, prospect });
  }
  return rows;
}

export async function getSequenceDetail(options: {
  orgId: string;
  sequenceId: string;
}): Promise<SequenceDetail | null> {
  const supabase = await createClient();
  const [{ data: sequence }, { data: steps }, { data: enrollments }, interactions] = await Promise.all([
    supabase
      .from("antidotes_sequences")
      .select("*")
      .eq("org_id", options.orgId)
      .eq("id", options.sequenceId)
      .maybeSingle(),
    supabase
      .from("antidotes_sequence_steps")
      .select("*")
      .eq("org_id", options.orgId)
      .eq("sequence_id", options.sequenceId)
      .order("position"),
    supabase
      .from("antidotes_sequence_enrollments")
      .select("*")
      .eq("org_id", options.orgId)
      .eq("sequence_id", options.sequenceId)
      .order("enrolled_at", { ascending: false })
      .limit(1000),
    interactionsBySequence(options.orgId),
  ]);
  if (!sequence) return null;
  const row = sequence as unknown as Sequence;
  const list = (enrollments ?? []) as unknown as SequenceEnrollment[];
  const rows = await loadEnrollmentRows(options.orgId, list);
  const contacted = list.filter((entry) => entry.last_sent_at !== null).length;

  return {
    sequence: row,
    settings: resolveSequenceSettings(row.settings),
    steps: (steps ?? []) as unknown as SequenceStep[],
    enrollments: rows,
    counts: computeSequenceCounts(list, interactions.get(row.id) ?? [], contacted),
  };
}

export type LinkedinTodo = EnrollmentRow & { sequence: Sequence };

/** Les pistes LinkedIn à faire à la main, toutes séquences confondues. */
export async function listLinkedinTodo(options: { orgId: string }): Promise<LinkedinTodo[]> {
  const supabase = await createClient();
  const { data: enrollments } = await supabase
    .from("antidotes_sequence_enrollments")
    .select("*")
    .eq("org_id", options.orgId)
    .eq("channel", "linkedin")
    .eq("status", "active")
    .order("enrolled_at", { ascending: true })
    .limit(200);
  const list = (enrollments ?? []) as unknown as SequenceEnrollment[];
  if (list.length === 0) return [];
  const sequenceIds = [...new Set(list.map((row) => row.sequence_id))];
  const [rows, { data: sequenceRows }] = await Promise.all([
    loadEnrollmentRows(options.orgId, list),
    supabase.from("antidotes_sequences").select("*").eq("org_id", options.orgId).in("id", sequenceIds),
  ]);
  const sequences = new Map(((sequenceRows ?? []) as unknown as Sequence[]).map((row) => [row.id, row]));
  return rows.flatMap((row) => {
    const sequence = sequences.get(row.enrollment.sequence_id);
    return sequence ? [{ ...row, sequence }] : [];
  });
}

/** La garde des rebonds sur sept jours, pour le bandeau de l'écran. */
export async function getBounceGuard(options: { orgId: string }): Promise<BounceGuard> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [sent, bounced] = await Promise.all([
    supabase
      .from("antidotes_interactions")
      .select("id", { count: "exact", head: true })
      .eq("org_id", options.orgId)
      .eq("type", "email_sent")
      .gte("occurred_at", since),
    supabase
      .from("antidotes_interactions")
      .select("id", { count: "exact", head: true })
      .eq("org_id", options.orgId)
      .eq("type", "bounce")
      .gte("occurred_at", since),
  ]);
  return evaluateBounceGuard(sent.count ?? 0, bounced.count ?? 0);
}

/** Les inscriptions d'un prospect, pour le panneau du pipeline. */
export async function listProspectEnrollments(options: {
  orgId: string;
  prospectId: string;
}): Promise<{ enrollment: SequenceEnrollment; sequenceName: string }[]> {
  const supabase = await createClient();
  const { data: contacts } = await supabase
    .from("antidotes_contacts")
    .select("id")
    .eq("org_id", options.orgId)
    .eq("prospect_id", options.prospectId);
  const contactIds = ((contacts ?? []) as unknown as { id: string }[]).map((row) => row.id);
  if (contactIds.length === 0) return [];
  const { data: enrollments } = await supabase
    .from("antidotes_sequence_enrollments")
    .select("*")
    .eq("org_id", options.orgId)
    .in("contact_id", contactIds)
    .order("enrolled_at", { ascending: false })
    .limit(20);
  const list = (enrollments ?? []) as unknown as SequenceEnrollment[];
  if (list.length === 0) return [];
  const { data: sequences } = await supabase
    .from("antidotes_sequences")
    .select("id, name")
    .eq("org_id", options.orgId)
    .in("id", [...new Set(list.map((row) => row.sequence_id))]);
  const names = new Map(((sequences ?? []) as unknown as { id: string; name: string }[]).map((row) => [row.id, row.name]));
  return list.map((enrollment) => ({ enrollment, sequenceName: names.get(enrollment.sequence_id) ?? "Séquence" }));
}
