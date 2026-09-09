"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { STALE_RUN_MINUTES } from "@/lib/antidotes/sourcing/run";
import {
  campaignReadiness,
  resolveCampaignConfig,
} from "@/lib/antidotes/sourcing/config";
import { getActiveRun } from "@/lib/antidotes/queries";
import type {
  Campaign,
  CampaignFilters,
  CampaignSourceParams,
  CampaignTargeting,
  DiscoverySourceKey,
  EmailProviderKey,
} from "@/lib/antidotes/types";
import { getViewer } from "@/lib/auth";
import {
  dispatchSourcingWorkflow,
  syncDispatchUnavailable,
} from "@/lib/finance/github-actions";
import { createClient } from "@/lib/supabase/server";

/**
 * Actions des campagnes de sourcing.
 *
 * Même garde que le pipeline : l'owner de l'organisation, et lui seul. Une
 * campagne est un jeu de filtres nommé ; tout ce que le cahier des charges
 * décrit se règle ici, rien n'est codé en dur — les trois jsonb sont
 * reconstruits entiers à chaque enregistrement, validés par zod à la
 * frontière.
 */

export type SourcingResult =
  | { ok: true; message?: string; id?: string }
  | { ok: false; error: string };

const SOURCING_PATH = "/antidotes/outbound/sourcing";

async function guardOwner(): Promise<{ orgId: string }> {
  const viewer = await getViewer();
  if (!viewer) throw new Error("Session expirée.");
  const orgId = viewer.ownedOrgIds[0];
  if (!viewer.isOwner || !orgId) throw new Error("Action indisponible.");
  return { orgId };
}

function fail(error: unknown): SourcingResult {
  return { ok: false, error: (error as Error).message };
}

function firstIssue(error: z.ZodError, fallback: string): SourcingResult {
  return { ok: false, error: error.issues[0]?.message ?? fallback };
}

const formValue = (formData: FormData, key: string): string => String(formData.get(key) ?? "");

/** Une liste saisie en champ libre : une entrée par ligne ou par virgule. */
function listOf(raw: string, max = 50): string[] {
  return [
    ...new Set(
      raw
        .split(/[\n,;]+/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  ].slice(0, max);
}

const optionalNumber = (min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? Number(value.replace(",", ".")) : null))
    .refine((value) => value === null || (Number.isFinite(value) && value >= min && value <= max), {
      message: `Valeur attendue entre ${min} et ${max}.`,
    });

const requiredNumber = (min: number, max: number, fallback: number) =>
  optionalNumber(min, max).transform((value) => value ?? fallback);

// --- Création ------------------------------------------------------------------

const createInput = z.object({
  name: z.string().trim().min(1, "Le nom de la campagne est requis.").max(120),
  engine: z.enum(["maps", "ecommerce"]),
  referenceClient: z.string().trim().max(120),
});

export async function createCampaign(
  _previous: SourcingResult | null,
  formData: FormData,
): Promise<SourcingResult> {
  const parsed = createInput.safeParse({
    name: formValue(formData, "name"),
    engine: formValue(formData, "engine") || "maps",
    referenceClient: formValue(formData, "referenceClient"),
  });
  if (!parsed.success) return firstIssue(parsed.error, "Saisie invalide.");

  try {
    const { orgId } = await guardOwner();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("antidotes_campaigns")
      .insert({
        org_id: orgId,
        name: parsed.data.name,
        engine: parsed.data.engine,
        reference_client: parsed.data.referenceClient || null,
        source_params: {},
        filters: {},
        targeting: {},
        is_active: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    revalidatePath(SOURCING_PATH);
    return { ok: true, message: "Campagne créée.", id: (data as unknown as { id: string }).id };
  } catch (error) {
    return fail(error);
  }
}

// --- Réglages --------------------------------------------------------------------

const DISCOVERY_KEYS: DiscoverySourceKey[] = ["linkedin", "legal_registry", "website"];
const EMAIL_KEYS: EmailProviderKey[] = ["dropcontact", "hunter", "pattern"];

const saveInput = z.object({
  campaignId: z.uuid(),
  name: z.string().trim().min(1, "Le nom de la campagne est requis.").max(120),
  referenceClient: z.string().trim().max(120),
  isActive: z.boolean(),
  // Cible
  keywords: z.string().max(2000),
  cities: z.string().max(2000),
  radiusKm: requiredNumber(1, 200, 10),
  maxPlaces: requiredNumber(1, 1000, 100),
  category: z.string().trim().max(120),
  country: z.string().trim().max(2).toUpperCase(),
  trafficMin: optionalNumber(0, 100_000_000),
  trafficMax: optionalNumber(0, 100_000_000),
  adLibraryUrl: z.string().trim().max(2000, "L'URL de la Bibliothèque est trop longue."),
  // Filtres
  sizeTolerance: requiredNumber(10, 100, 40),
  requireAds: z.enum(["oui", "non", "bonus"]),
  // Les cases cochées ; ce qui n'est pas un code alpha-2 est filtré plus bas
  // plutôt que de faire échouer l'enregistrement entier.
  countries: z.array(z.string().trim().max(10)).max(60),
  minRating: requiredNumber(0, 5, 4),
  referenceSector: z.string().trim().max(120),
  referenceSize: optionalNumber(0, 100_000_000),
  weightAds: requiredNumber(0, 100, 40),
  weightSize: requiredNumber(0, 100, 30),
  weightContact: requiredNumber(0, 100, 20),
  weightSector: requiredNumber(0, 100, 10),
  // Décisionnaire et adresses
  jobKeywords: z.string().max(3000),
  marketingThreshold: requiredNumber(0, 100_000, 20),
  discoveryOrder: z.string().max(200),
  enrichmentOrder: z.string().max(200),
  verificationTtlDays: requiredNumber(1, 3650, 180),
});

/** L'ordre saisi, nettoyé des inconnus, complété des oubliés — dans cet ordre. */
function orderedKeys<K extends string>(raw: string, known: K[]): K[] {
  const listed = listOf(raw).filter((key): key is K => (known as string[]).includes(key));
  return [...listed, ...known.filter((key) => !listed.includes(key))];
}

export async function saveCampaign(
  _previous: SourcingResult | null,
  formData: FormData,
): Promise<SourcingResult> {
  const parsed = saveInput.safeParse({
    campaignId: formValue(formData, "campaignId"),
    name: formValue(formData, "name"),
    referenceClient: formValue(formData, "referenceClient"),
    isActive: formData.get("isActive") === "on",
    keywords: formValue(formData, "keywords"),
    cities: formValue(formData, "cities"),
    radiusKm: formValue(formData, "radiusKm"),
    maxPlaces: formValue(formData, "maxPlaces"),
    category: formValue(formData, "category"),
    country: formValue(formData, "country") || "FR",
    trafficMin: formValue(formData, "trafficMin"),
    trafficMax: formValue(formData, "trafficMax"),
    adLibraryUrl: formValue(formData, "adLibraryUrl"),
    sizeTolerance: formValue(formData, "sizeTolerance"),
    requireAds: formValue(formData, "requireAds") || "oui",
    // Une case par pays : toutes les valeurs cochées, pas la première.
    countries: formData.getAll("countries").map((value) => String(value)),
    minRating: formValue(formData, "minRating"),
    referenceSector: formValue(formData, "referenceSector"),
    referenceSize: formValue(formData, "referenceSize"),
    weightAds: formValue(formData, "weightAds"),
    weightSize: formValue(formData, "weightSize"),
    weightContact: formValue(formData, "weightContact"),
    weightSector: formValue(formData, "weightSector"),
    jobKeywords: formValue(formData, "jobKeywords"),
    marketingThreshold: formValue(formData, "marketingThreshold"),
    discoveryOrder: formValue(formData, "discoveryOrder"),
    enrichmentOrder: formValue(formData, "enrichmentOrder"),
    verificationTtlDays: formValue(formData, "verificationTtlDays"),
  });
  if (!parsed.success) return firstIssue(parsed.error, "Saisie invalide.");
  const input = parsed.data;

  const countries = [
    ...new Set(input.countries.map((code) => code.toUpperCase()).filter((code) => /^[A-Z]{2}$/.test(code))),
  ];

  const source_params: CampaignSourceParams = {
    keywords: listOf(input.keywords),
    cities: listOf(input.cities),
    radius_km: input.radiusKm,
    max_places: Math.round(input.maxPlaces),
    category: input.category,
    country: /^[A-Z]{2}$/.test(input.country) ? input.country : "FR",
    traffic_min: input.trafficMin,
    traffic_max: input.trafficMax,
    // L'URL est gardée même si elle ne se lit pas : l'écran le dit à côté du
    // champ, et le passage ne s'en sert que lorsqu'elle se lit.
    ad_library_url: input.adLibraryUrl || null,
  };

  const filters: CampaignFilters = {
    size_tolerance: input.sizeTolerance / 100,
    require_ads: input.requireAds === "oui" ? true : input.requireAds === "non" ? false : "bonus",
    countries,
    min_rating: input.minRating,
    reference_sector: input.referenceSector || null,
    // Le signal de référence suit le moteur : des avis pour un lieu, du trafic
    // pour une boutique — c'est sur ce signal que la taille se compare.
    reference_size:
      input.referenceSize === null
        ? null
        : formValue(formData, "engine") === "ecommerce"
          ? { traffic: input.referenceSize }
          : { reviews_count: input.referenceSize },
    scoring: {
      ads_active: input.weightAds,
      size_in_range: input.weightSize,
      reachable_contact: input.weightContact,
      same_sector: input.weightSector,
    },
  };

  const targeting: CampaignTargeting = {
    job_keywords: listOf(input.jobKeywords, 60),
    marketing_threshold: Math.round(input.marketingThreshold),
    discovery_sources: orderedKeys(input.discoveryOrder, DISCOVERY_KEYS).map((source) => ({
      source,
      enabled: formData.get(`discovery_${source}`) === "on",
    })),
    enrichment_waterfall: orderedKeys(input.enrichmentOrder, EMAIL_KEYS).map((provider) => ({
      provider,
      enabled: formData.get(`email_${provider}`) === "on",
    })),
    verification_ttl_days: Math.round(input.verificationTtlDays),
  };

  try {
    const { orgId } = await guardOwner();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("antidotes_campaigns")
      .update({
        name: input.name,
        reference_client: input.referenceClient || null,
        is_active: input.isActive,
        source_params,
        filters,
        targeting,
      })
      .eq("org_id", orgId)
      .eq("id", input.campaignId)
      .select("id");
    if (error) throw new Error(error.message);
    if ((data ?? []).length === 0) throw new Error("Campagne introuvable.");

    revalidatePath(SOURCING_PATH);
    revalidatePath(`${SOURCING_PATH}/${input.campaignId}`);
    return { ok: true, message: "Campagne enregistrée." };
  } catch (error) {
    return fail(error);
  }
}

// --- Lancement -------------------------------------------------------------------

/**
 * Pose un passage en file, puis donne l'ordre à GitHub de l'exécuter. Sans
 * jeton — ou si GitHub refuse —, le passage reste en file : le tour
 * programmé le prendra, et le message le dit.
 */
export async function launchCampaign(input: { campaignId: string }): Promise<SourcingResult> {
  const parsed = z.object({ campaignId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Campagne invalide." };

  try {
    const { orgId } = await guardOwner();
    const supabase = await createClient();

    const { data: row } = await supabase
      .from("antidotes_campaigns")
      .select("*")
      .eq("org_id", orgId)
      .eq("id", parsed.data.campaignId)
      .maybeSingle();
    const campaign = row as unknown as Campaign | null;
    if (!campaign) throw new Error("Campagne introuvable.");

    const missing = campaignReadiness(resolveCampaignConfig(campaign));
    if (missing.length > 0) throw new Error(`Il manque ${missing.join(" et ")}.`);

    const active = await getActiveRun({ orgId, campaignId: campaign.id });
    if (active) {
      const stale =
        active.status === "running" &&
        active.heartbeat_at !== null &&
        Date.now() - new Date(active.heartbeat_at).getTime() > STALE_RUN_MINUTES * 60_000;
      if (!stale) throw new Error("Un passage est déjà en file ou en cours.");
    }

    if (!active) {
      const { error } = await supabase
        .from("antidotes_campaign_runs")
        .insert({ org_id: orgId, campaign_id: campaign.id, status: "queued", stage: "sourcing" });
      if (error) throw new Error(error.message);
    }

    revalidatePath(SOURCING_PATH);
    revalidatePath(`${SOURCING_PATH}/${campaign.id}`);

    const unavailable = syncDispatchUnavailable();
    if (unavailable) return { ok: true, message: "Passage en file — il partira au prochain tour programmé." };
    try {
      await dispatchSourcingWorkflow();
      return { ok: true, message: "Passage lancé." };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return { ok: true, message: `Passage en file — le déclenchement immédiat a échoué (${detail}).` };
    }
  } catch (error) {
    return fail(error);
  }
}

// --- Activation et suppression ---------------------------------------------------

export async function setCampaignActive(input: {
  campaignId: string;
  active: boolean;
}): Promise<SourcingResult> {
  const parsed = z.object({ campaignId: z.uuid(), active: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Campagne invalide." };
  try {
    const { orgId } = await guardOwner();
    const supabase = await createClient();
    const { error } = await supabase
      .from("antidotes_campaigns")
      .update({ is_active: parsed.data.active })
      .eq("org_id", orgId)
      .eq("id", parsed.data.campaignId);
    if (error) throw new Error(error.message);
    revalidatePath(SOURCING_PATH);
    revalidatePath(`${SOURCING_PATH}/${parsed.data.campaignId}`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Supprime la campagne et ses passages ; les prospects restent, sans origine. */
export async function deleteCampaign(input: { campaignId: string }): Promise<SourcingResult> {
  const parsed = z.object({ campaignId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Campagne invalide." };
  try {
    const { orgId } = await guardOwner();
    const supabase = await createClient();
    const { error } = await supabase
      .from("antidotes_campaigns")
      .delete()
      .eq("org_id", orgId)
      .eq("id", parsed.data.campaignId);
    if (error) throw new Error(error.message);
    revalidatePath(SOURCING_PATH);
    return { ok: true, message: "Campagne supprimée." };
  } catch (error) {
    return fail(error);
  }
}
