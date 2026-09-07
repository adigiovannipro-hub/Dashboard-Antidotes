import "server-only";

import { createClient } from "@/lib/supabase/server";
import { listProspectEnrollments } from "./sequences/queries";
import type {
  Campaign,
  CampaignRun,
  Contact,
  Interaction,
  PipelineProspect,
  Prospect,
  SequenceEnrollment,
} from "./types";

/**
 * Lectures du pôle Antidotes.
 *
 * Tout `where` de tenant est explicite, même quand la RLS le porte déjà : en
 * accès ouvert le client de lecture est `service_role`, et une requête sans
 * `org_id` rendrait la prospection de tout le monde.
 *
 * Le pipeline se lit entier — quelques centaines de sociétés au plus — et se
 * filtre en mémoire (`pipeline-params.ts`) : les deux vues, les compteurs de
 * colonnes et la barre de filtres partagent ainsi la même liste.
 */

export type PipelineFacets = {
  sectors: string[];
  countries: string[];
  referenceClients: string[];
  campaigns: { id: string; name: string }[];
};

/**
 * Les prospects d'une organisation, contacts et nom de campagne compris.
 *
 * Trois requêtes en parallèle plutôt qu'une jointure PostgREST : les types
 * du dépôt ne déclarent pas de relations, et un assemblage en mémoire reste
 * lisible tant que le pipeline tient en mémoire — ce qui est le cas de
 * conception, pas un accident.
 */
export async function listPipelineProspects(options: {
  orgId: string;
  limit?: number;
}): Promise<{ prospects: PipelineProspect[]; facets: PipelineFacets }> {
  const supabase = await createClient();

  const [{ data: prospects }, { data: contacts }, { data: campaigns }] =
    await Promise.all([
      supabase
        .from("antidotes_prospects")
        .select("*")
        .eq("org_id", options.orgId)
        .order("updated_at", { ascending: false })
        .limit(options.limit ?? 1000),
      supabase
        .from("antidotes_contacts")
        .select("*")
        .eq("org_id", options.orgId)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(5000),
      supabase
        .from("antidotes_campaigns")
        .select("id, name")
        .eq("org_id", options.orgId)
        .order("name", { ascending: true })
        .limit(200),
    ]);

  const contactsByProspect = new Map<string, Contact[]>();
  for (const contact of (contacts ?? []) as unknown as Contact[]) {
    const list = contactsByProspect.get(contact.prospect_id) ?? [];
    list.push(contact);
    contactsByProspect.set(contact.prospect_id, list);
  }

  const campaignRows = (campaigns ?? []) as unknown as { id: string; name: string }[];
  const campaignName = new Map(campaignRows.map((campaign) => [campaign.id, campaign.name]));

  const rows: PipelineProspect[] = ((prospects ?? []) as unknown as Prospect[]).map(
    (prospect) => ({
      ...prospect,
      contacts: contactsByProspect.get(prospect.id) ?? [],
      campaign_name: prospect.campaign_id
        ? (campaignName.get(prospect.campaign_id) ?? null)
        : null,
    }),
  );

  return { prospects: rows, facets: buildFacets(rows, campaignRows) };
}

/** Les valeurs distinctes qui alimentent la barre de filtres, triées en français. */
function buildFacets(
  rows: PipelineProspect[],
  campaigns: { id: string; name: string }[],
): PipelineFacets {
  const collator = new Intl.Collator("fr");
  const distinct = (values: (string | null)[]) =>
    [...new Set(values.filter((value): value is string => Boolean(value)))].sort(
      collator.compare,
    );
  return {
    sectors: distinct(rows.map((row) => row.sector)),
    countries: distinct(rows.map((row) => row.country)),
    referenceClients: distinct(rows.map((row) => row.reference_client)),
    campaigns,
  };
}

export type ProspectEnrollmentSummary = { enrollment: SequenceEnrollment; sequenceName: string };

export type ProspectDetail = {
  prospect: PipelineProspect;
  interactions: Interaction[];
  /** Les séquences où ce prospect est inscrit, la plus récente en tête. */
  enrollments: ProspectEnrollmentSummary[];
};

/**
 * Un prospect ouvert dans le panneau : sa ligne, ses contacts, sa timeline.
 *
 * `null` quand l'identifiant ne désigne rien dans cette organisation — un
 * lien périmé ne doit pas casser la page, seulement laisser le panneau fermé.
 */
export async function getProspectDetail(options: {
  orgId: string;
  prospectId: string;
}): Promise<ProspectDetail | null> {
  const supabase = await createClient();

  const [{ data: prospect }, { data: contacts }, { data: interactions }, enrollments] =
    await Promise.all([
      supabase
        .from("antidotes_prospects")
        .select("*")
        .eq("org_id", options.orgId)
        .eq("id", options.prospectId)
        .maybeSingle(),
      supabase
        .from("antidotes_contacts")
        .select("*")
        .eq("org_id", options.orgId)
        .eq("prospect_id", options.prospectId)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(100),
      supabase
        .from("antidotes_interactions")
        .select("*")
        .eq("org_id", options.orgId)
        .eq("prospect_id", options.prospectId)
        .order("occurred_at", { ascending: false })
        .limit(200),
      listProspectEnrollments({ orgId: options.orgId, prospectId: options.prospectId }),
    ]);

  if (!prospect) return null;
  const row = prospect as unknown as Prospect;

  let campaignName: string | null = null;
  if (row.campaign_id) {
    const { data: campaign } = await supabase
      .from("antidotes_campaigns")
      .select("name")
      .eq("org_id", options.orgId)
      .eq("id", row.campaign_id)
      .maybeSingle();
    campaignName = (campaign as unknown as { name: string } | null)?.name ?? null;
  }

  return {
    prospect: {
      ...row,
      contacts: (contacts ?? []) as unknown as Contact[],
      campaign_name: campaignName,
    },
    interactions: (interactions ?? []) as unknown as Interaction[],
    enrollments,
  };
}

// --- Sourcing (phase 2) ------------------------------------------------------

/** Une campagne telle que la liste l'affiche : son dernier passage, ses prospects. */
export type CampaignSummary = Campaign & {
  latest_run: CampaignRun | null;
  prospect_count: number;
};

export async function listCampaigns(options: { orgId: string }): Promise<CampaignSummary[]> {
  const supabase = await createClient();

  const [{ data: campaigns }, { data: runs }, { data: prospects }] = await Promise.all([
    supabase
      .from("antidotes_campaigns")
      .select("*")
      .eq("org_id", options.orgId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("antidotes_campaign_runs")
      .select("*")
      .eq("org_id", options.orgId)
      .order("requested_at", { ascending: false })
      .limit(500),
    supabase
      .from("antidotes_prospects")
      .select("campaign_id")
      .eq("org_id", options.orgId)
      .not("campaign_id", "is", null)
      .limit(5000),
  ]);

  // Le plus récent passage de chaque campagne : la liste arrive triée, le
  // premier vu gagne.
  const latestByCampaign = new Map<string, CampaignRun>();
  for (const run of (runs ?? []) as unknown as CampaignRun[]) {
    if (!latestByCampaign.has(run.campaign_id)) latestByCampaign.set(run.campaign_id, run);
  }
  const countByCampaign = new Map<string, number>();
  for (const row of (prospects ?? []) as unknown as { campaign_id: string }[]) {
    countByCampaign.set(row.campaign_id, (countByCampaign.get(row.campaign_id) ?? 0) + 1);
  }

  return ((campaigns ?? []) as unknown as Campaign[]).map((campaign) => ({
    ...campaign,
    latest_run: latestByCampaign.get(campaign.id) ?? null,
    prospect_count: countByCampaign.get(campaign.id) ?? 0,
  }));
}

export type CampaignDetail = {
  campaign: Campaign;
  runs: CampaignRun[];
  prospect_count: number;
};

export async function getCampaignDetail(options: {
  orgId: string;
  campaignId: string;
}): Promise<CampaignDetail | null> {
  const supabase = await createClient();

  const [{ data: campaign }, { data: runs }, { count }] = await Promise.all([
    supabase
      .from("antidotes_campaigns")
      .select("*")
      .eq("org_id", options.orgId)
      .eq("id", options.campaignId)
      .maybeSingle(),
    supabase
      .from("antidotes_campaign_runs")
      .select("*")
      .eq("org_id", options.orgId)
      .eq("campaign_id", options.campaignId)
      .order("requested_at", { ascending: false })
      .limit(20),
    supabase
      .from("antidotes_prospects")
      .select("id", { count: "exact", head: true })
      .eq("org_id", options.orgId)
      .eq("campaign_id", options.campaignId),
  ]);

  if (!campaign) return null;
  return {
    campaign: campaign as unknown as Campaign,
    runs: (runs ?? []) as unknown as CampaignRun[],
    prospect_count: count ?? 0,
  };
}

/** Un passage en file ou en cours pour cette campagne — on n'en lance pas deux. */
export async function getActiveRun(options: {
  orgId: string;
  campaignId: string;
}): Promise<CampaignRun | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("antidotes_campaign_runs")
    .select("*")
    .eq("org_id", options.orgId)
    .eq("campaign_id", options.campaignId)
    .in("status", ["queued", "running"])
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as unknown as CampaignRun | null) ?? null;
}

/** La campagne d'un prospect, pour recalculer son score avec ses poids. */
export async function getCampaign(options: {
  orgId: string;
  campaignId: string;
}): Promise<Campaign | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("antidotes_campaigns")
    .select("*")
    .eq("org_id", options.orgId)
    .eq("id", options.campaignId)
    .maybeSingle();
  return (data as unknown as Campaign | null) ?? null;
}
