import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import type { Campaign, CampaignRun, Contact, Prospect } from "../types";
import type { ContactInsert, ProspectInsert, SourcingStore } from "./run";

/**
 * La persistance du passage, sur Supabase en `service_role` : un passage
 * tourne sur une machine GitHub, sans session. Chaque écriture teste
 * l'erreur — un `data` nul sur une table absente ferait un passage muet.
 */
export function createSourcingStore(admin: SupabaseClient<Database>): SourcingStore {
  const fail = (step: string, error: { message: string } | null) => {
    if (error) throw new Error(`${step} : ${error.message}`);
  };

  return {
    async saveRun(id, patch) {
      const { error } = await admin
        .from("antidotes_campaign_runs")
        .update(patch as never)
        .eq("id", id);
      fail("passage", error);
    },

    async saveCampaign(id, patch) {
      const { error } = await admin
        .from("antidotes_campaigns")
        .update(patch as never)
        .eq("id", id);
      fail("campagne", error);
    },

    async findProspectByExternalId(orgId, key, value) {
      const { data, error } = await admin
        .from("antidotes_prospects")
        .select("*")
        .eq("org_id", orgId)
        .eq(`external_ids->>${key}`, value)
        .limit(1)
        .maybeSingle();
      fail("prospect", error);
      return (data as unknown as Prospect | null) ?? null;
    },

    async insertProspect(row: ProspectInsert) {
      const { data, error } = await admin
        .from("antidotes_prospects")
        .insert(row as never)
        .select("*")
        .single();
      fail("prospect", error);
      return data as unknown as Prospect;
    },

    async updateProspect(id, patch) {
      const { error } = await admin
        .from("antidotes_prospects")
        .update(patch as never)
        .eq("id", id);
      fail("prospect", error);
    },

    async listProspectsAwaitingDiscovery(runId) {
      const { data, error } = await admin
        .from("antidotes_prospects")
        .select("*")
        .eq("last_run_id", runId)
        .eq("status", "qualified")
        .is("enrichment->>discovery_at", null)
        .order("created_at", { ascending: true })
        .limit(1000);
      fail("prospects à enrichir", error);
      return (data ?? []) as unknown as Prospect[];
    },

    async listProspectsAwaitingEmail(runId) {
      const { data, error } = await admin
        .from("antidotes_prospects")
        .select("*")
        .eq("last_run_id", runId)
        .is("enrichment->>email_at", null)
        .not("enrichment->>discovery_at", "is", null)
        .order("created_at", { ascending: true })
        .limit(1000);
      fail("prospects à vérifier", error);
      const prospects = (data ?? []) as unknown as Prospect[];
      if (prospects.length === 0) return [];

      const { data: contacts, error: contactsError } = await admin
        .from("antidotes_contacts")
        .select("*")
        .in(
          "prospect_id",
          prospects.map((prospect) => prospect.id),
        )
        .eq("is_primary", true)
        .limit(1000);
      fail("contacts", contactsError);
      const primaryByProspect = new Map(
        ((contacts ?? []) as unknown as Contact[]).map((contact) => [contact.prospect_id, contact]),
      );
      return prospects.flatMap((prospect) => {
        const contact = primaryByProspect.get(prospect.id);
        return contact ? [{ prospect, contact }] : [];
      });
    },

    async listContacts(prospectId) {
      const { data, error } = await admin
        .from("antidotes_contacts")
        .select("*")
        .eq("prospect_id", prospectId)
        .order("is_primary", { ascending: false })
        .limit(100);
      fail("contacts", error);
      return (data ?? []) as unknown as Contact[];
    },

    async insertContact(row: ContactInsert) {
      const { data, error } = await admin
        .from("antidotes_contacts")
        .insert(row as never)
        .select("*")
        .single();
      fail("contact", error);
      return data as unknown as Contact;
    },

    async updateContact(id, patch) {
      const { error } = await admin
        .from("antidotes_contacts")
        .update(patch as never)
        .eq("id", id);
      fail("contact", error);
    },
  };
}

/** Les passages à traiter : en file, ou en cours sans battement récent. */
export async function listRunnableRuns(
  admin: SupabaseClient<Database>,
  options: { staleBefore: string },
): Promise<CampaignRun[]> {
  const { data, error } = await admin
    .from("antidotes_campaign_runs")
    .select("*")
    .in("status", ["queued", "running"])
    .order("requested_at", { ascending: true })
    .limit(20);
  if (error) throw new Error(`passages : ${error.message}`);
  return ((data ?? []) as unknown as CampaignRun[]).filter(
    (run) =>
      run.status === "queued" || run.heartbeat_at === null || run.heartbeat_at < options.staleBefore,
  );
}

export async function loadCampaign(
  admin: SupabaseClient<Database>,
  campaignId: string,
): Promise<Campaign | null> {
  const { data, error } = await admin
    .from("antidotes_campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();
  if (error) throw new Error(`campagne : ${error.message}`);
  return (data as unknown as Campaign | null) ?? null;
}
