/**
 * Un passage de campagne, étape par étape.
 *
 *   1. sourcer — le moteur rend des sociétés, qualifiées **avant** d'entrer
 *      dans le pipeline : les rejets sont comptés, jamais stockés ;
 *   2. trouver le décisionnaire — les sources en cascade, dans l'ordre de la
 *      campagne, jusqu'au premier nom ; sans nom, `no_contact_found` ;
 *   3. obtenir et vérifier l'adresse — la cascade de fournisseurs, jusqu'à
 *      une adresse valide ; le statut décide seul du canal d'approche.
 *
 * Le passage est **résumable** : chaque prospect porte ce qui a été fait
 * (`enrichment`), le passage porte son étape et ses compteurs, et un budget
 * de temps arrête proprement une tranche — le passage suivant reprend où il
 * en était. Une erreur de fournisseur s'inscrit et n'arrête rien ; seul un
 * moteur qui échoue met le passage en erreur, puisque rien ne suit sans lui.
 *
 * Sans base ni réseau en propre : la persistance (`SourcingStore`) et les
 * fournisseurs (`Providers`) sont injectés, ce qui rend le passage testable
 * de bout en bout avec des doublures.
 */

import { computeScore } from "../scoring";
import type {
  Campaign,
  CampaignRun,
  Contact,
  DiscoverySourceKey,
  Prospect,
  RunError,
  RunStats,
  Seniority,
} from "../types";
import { campaignReadiness, resolveCampaignConfig, type ResolvedCampaignConfig } from "./config";
import { pickDecisionMaker, type PersonCandidate } from "./decision-maker";
import { findEmail } from "./email/cascade";
import { completeRunStats } from "./funnel";
import type { Providers, SourcedCompany } from "./providers";
import { qualifyCandidate } from "./qualify";

/** Ce que le passage insère pour une société qualifiée. */
export type ProspectInsert = Omit<Prospect, "id" | "created_at" | "updated_at">;

export type ContactInsert = Omit<Contact, "id" | "created_at" | "updated_at" | "outreach_channel">;

/** La persistance vue par le passage — une implémentation Supabase, une doublure en test. */
export type SourcingStore = {
  saveRun(id: string, patch: Partial<CampaignRun>): Promise<void>;
  saveCampaign(id: string, patch: Partial<Campaign>): Promise<void>;
  findProspectByExternalId(orgId: string, key: "place_id" | "siren", value: string): Promise<Prospect | null>;
  insertProspect(row: ProspectInsert): Promise<Prospect>;
  updateProspect(id: string, patch: Partial<Prospect>): Promise<void>;
  /** Les prospects qualifiés du passage dont le décisionnaire n'a pas été cherché. */
  listProspectsAwaitingDiscovery(runId: string): Promise<Prospect[]>;
  /** Les prospects du passage dont l'adresse du contact principal n'a pas été cherchée. */
  listProspectsAwaitingEmail(runId: string): Promise<{ prospect: Prospect; contact: Contact }[]>;
  listContacts(prospectId: string): Promise<Contact[]>;
  insertContact(row: ContactInsert): Promise<Contact>;
  updateContact(id: string, patch: Partial<Contact>): Promise<void>;
};

export type RunOptions = {
  store: SourcingStore;
  providers: Providers;
  campaign: Campaign;
  run: CampaignRun;
  now: () => Date;
  /** Le budget de la tranche : au-delà, on sauve et on rend la main. */
  deadline: Date;
};

export type RunReport = {
  status: CampaignRun["status"];
  stage: CampaignRun["stage"];
  stats: RunStats;
  errors: RunError[];
  /** Vrai quand le budget est épuisé et qu'un passage suivant doit reprendre. */
  interrupted: boolean;
};

const MAX_ERRORS = 50;

/** Un passage reste `running` sans battement au-delà d'une heure : il est mort, on le reprend. */
export const STALE_RUN_MINUTES = 60;

const isoNow = (now: () => Date) => now().toISOString();

export async function runCampaign(options: RunOptions): Promise<RunReport> {
  const { store, providers, campaign, run, now } = options;
  const config = resolveCampaignConfig(campaign);
  const stats = completeRunStats(run.stats);
  const errors: RunError[] = [...(run.errors ?? [])];
  let stage = run.stage;
  let interrupted = false;

  const record = (step: string, error: unknown, prospect?: string) => {
    if (errors.length >= MAX_ERRORS) return;
    errors.push({
      at: isoNow(now),
      step,
      message: error instanceof Error ? error.message : String(error),
      ...(prospect ? { prospect } : {}),
    });
  };
  const checkpoint = async (patch: Partial<CampaignRun> = {}) =>
    store.saveRun(run.id, { stats, errors, stage, heartbeat_at: isoNow(now), ...patch });
  const outOfTime = () => now().getTime() >= options.deadline.getTime();

  await checkpoint({
    status: "running",
    started_at: run.started_at ?? isoNow(now),
  });

  // --- 1. Sourcer ------------------------------------------------------------
  if (stage === "sourcing") {
    const missing = campaignReadiness(config);
    const engine = providers.engines[campaign.engine];
    if (missing.length > 0 || !engine) {
      record(
        "sourcing",
        missing.length > 0
          ? `Campagne incomplète : ${missing.join(", ")}.`
          : `Aucun moteur branché pour « ${campaign.engine} ».`,
      );
      await checkpoint({ status: "error", finished_at: isoNow(now) });
      return { status: "error", stage, stats, errors, interrupted: false };
    }

    let companies: SourcedCompany[];
    try {
      companies = await engine(config.source);
    } catch (error) {
      record("sourcing", error);
      await checkpoint({ status: "error", finished_at: isoNow(now) });
      return { status: "error", stage, stats, errors, interrupted: false };
    }

    stats.sourced = companies.length;
    for (const company of companies) {
      await admitCompany({ company, config, campaign, run, providers, store, stats, now, record });
    }
    stage = "discovering";
    await checkpoint();
  }

  // --- 2. Le décisionnaire -----------------------------------------------------
  if (stage === "discovering") {
    for (const prospect of await store.listProspectsAwaitingDiscovery(run.id)) {
      if (outOfTime()) {
        interrupted = true;
        break;
      }
      await discoverContact({ prospect, config, providers, store, stats, now, record });
      await checkpoint();
    }
    if (!interrupted) {
      stage = "verifying";
      await checkpoint();
    }
  }

  // --- 3. L'adresse ------------------------------------------------------------
  if (stage === "verifying" && !interrupted) {
    for (const { prospect, contact } of await store.listProspectsAwaitingEmail(run.id)) {
      if (outOfTime()) {
        interrupted = true;
        break;
      }
      await resolveEmail({ prospect, contact, config, providers, store, stats, now, record });
      await checkpoint();
    }
    if (!interrupted) {
      stage = "done";
    }
  }

  if (interrupted) {
    await checkpoint({ status: "running" });
    return { status: "running", stage, stats, errors, interrupted: true };
  }

  await checkpoint({ status: "done", finished_at: isoNow(now) });
  await store.saveCampaign(campaign.id, { last_run_at: isoNow(now), stats });
  return { status: "done", stage, stats, errors, interrupted: false };
}

// --- Étape 1 : admettre une société ------------------------------------------

async function admitCompany(input: {
  company: SourcedCompany;
  config: ResolvedCampaignConfig;
  campaign: Campaign;
  run: CampaignRun;
  providers: Providers;
  store: SourcingStore;
  stats: RunStats;
  now: () => Date;
  record: (step: string, error: unknown, prospect?: string) => void;
}): Promise<void> {
  const { company, config, campaign, run, providers, store, stats, now } = input;
  const country = company.country ?? config.source.country;

  // Les publicités ne se vérifient que si le filtre les regarde : chaque
  // appel compte, et « bonus » ou « non » n'en ont pas besoin pour trancher.
  let ads: boolean | null = null;
  let adsSeenAt: string | null = null;
  if (config.filters.require_ads !== false) {
    if (providers.ads) {
      const verdict = await providers.ads({ company_name: company.company_name, country });
      if (verdict) {
        ads = verdict.active;
        adsSeenAt = verdict.active ? (verdict.last_seen_at ?? isoNow(now)) : null;
      }
    }
  }

  const size_signal = company.reviews_count !== null ? { reviews_count: company.reviews_count } : {};
  const verdict = qualifyCandidate(
    { country, rating: company.rating, size_signal, ads_active: ads },
    config.filters,
  );

  if (verdict.outcome === "rejected") {
    const reason = verdict.reasons[0] ?? "rejeté";
    stats.rejected[reason] = (stats.rejected[reason] ?? 0) + 1;
    return;
  }

  const qualification = {
    outcome: verdict.outcome,
    reasons: verdict.reasons,
    size_ratio: verdict.size_ratio,
    checked_at: isoNow(now),
  };
  const placeId = company.external_ids.place_id;
  const existing = placeId ? await store.findProspectByExternalId(campaign.org_id, "place_id", placeId) : null;

  if (existing) {
    // Une société déjà connue rafraîchit ses signaux et se rattache au passage,
    // sans reculer d'un statut que le pipeline a fait avancer.
    await store.updateProspect(existing.id, {
      rating: company.rating ?? existing.rating,
      phone: company.phone ?? existing.phone,
      website: company.website ?? existing.website,
      size_signal: { ...existing.size_signal, ...size_signal },
      ads_active: ads ?? existing.ads_active,
      ads_last_seen_at: adsSeenAt ?? existing.ads_last_seen_at,
      qualification,
      campaign_id: existing.campaign_id ?? campaign.id,
      last_run_id: run.id,
      ...(existing.status === "to_qualify" && verdict.outcome === "qualified" ? { status: "qualified" as const } : {}),
    });
  } else {
    await store.insertProspect({
      org_id: campaign.org_id,
      campaign_id: campaign.id,
      source: campaign.engine === "maps" ? "maps" : "shopify",
      company_name: company.company_name,
      website: company.website,
      country,
      city: company.city,
      sector: company.sector,
      size_signal,
      ads_active: ads === true,
      ads_last_seen_at: adsSeenAt,
      status: verdict.outcome === "qualified" ? "qualified" : "to_qualify",
      score: computeScore({
        prospect: { ads_active: ads === true, sector: company.sector, size_signal },
        contacts: [],
        campaign: {
          filters: config.filters,
          reference_sector: config.filters.reference_sector,
          reference_size: config.filters.reference_size,
        },
      }),
      reference_client: config.reference_client,
      notes: null,
      external_ids: { ...company.external_ids },
      last_contact_at: null,
      rating: company.rating,
      phone: company.phone,
      qualification,
      enrichment: {},
      last_run_id: run.id,
    });
  }

  if (verdict.outcome === "qualified") stats.qualified += 1;
  else stats.to_review += 1;
}

// --- Étape 2 : le décisionnaire ------------------------------------------------

async function discoverContact(input: {
  prospect: Prospect;
  config: ResolvedCampaignConfig;
  providers: Providers;
  store: SourcingStore;
  stats: RunStats;
  now: () => Date;
  record: (step: string, error: unknown, prospect?: string) => void;
}): Promise<void> {
  const { prospect, config, providers, store, stats, now, record } = input;
  const errors: string[] = [];

  // Un contact déjà là — saisi à la main, ou trouvé par un passage précédent —
  // n'est pas recherché deux fois.
  const existing = await store.listContacts(prospect.id);
  if (existing.length > 0) {
    await store.updateProspect(prospect.id, {
      enrichment: { ...prospect.enrichment, discovery_at: isoNow(now), discovery_source: null, candidates: existing.length },
    });
    stats.contact_found += 1;
    return;
  }

  let employees: number | null = prospect.size_signal.employees ?? null;
  let siren: string | null = prospect.external_ids.siren ?? null;
  let candidates = 0;
  let found: { person: PersonCandidate; seniority: Seniority; source: DiscoverySourceKey } | null = null;

  for (const step of config.targeting.discovery_sources) {
    if (!step.enabled) continue;
    const finder = providers.discovery[step.source];
    if (!finder) continue;
    try {
      const result = await finder({
        company_name: prospect.company_name,
        website: prospect.website,
        city: prospect.city,
        postal_code: null,
        country: prospect.country,
      });
      if (typeof result.employees === "number") employees = result.employees;
      if (result.siren) siren = result.siren;
      candidates += result.people.length;
      const picked = pickDecisionMaker(result.people, {
        jobKeywords: config.targeting.job_keywords,
        marketingThreshold: config.targeting.marketing_threshold,
        employees,
      });
      if (picked) {
        found = { person: picked.person, seniority: picked.seniority, source: step.source };
        break;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${step.source} : ${message}`);
      record(`decisionnaire:${step.source}`, error, prospect.company_name);
    }
  }

  const enrichment = {
    ...prospect.enrichment,
    discovery_at: isoNow(now),
    discovery_source: found?.source ?? null,
    candidates,
    ...(errors.length > 0 ? { errors: [...(prospect.enrichment.errors ?? []), ...errors] } : {}),
  };
  const learned: Partial<Prospect> = {
    enrichment,
    ...(employees !== null ? { size_signal: { ...prospect.size_signal, employees } } : {}),
    ...(siren ? { external_ids: { ...prospect.external_ids, siren } } : {}),
  };

  if (!found) {
    await store.updateProspect(prospect.id, { ...learned, status: "no_contact_found" });
    return;
  }

  await store.insertContact({
    org_id: prospect.org_id,
    prospect_id: prospect.id,
    first_name: found.person.first_name,
    last_name: found.person.last_name,
    role: found.person.role,
    email: null,
    email_status: "unknown",
    linkedin_url: found.person.linkedin_url ?? null,
    phone: null,
    is_primary: true,
    seniority: found.seniority,
    discovery_source: found.source,
    email_source: null,
    email_verified_at: null,
    opted_out: false,
    opted_out_at: null,
  });
  await store.updateProspect(prospect.id, learned);
  stats.contact_found += 1;
}

// --- Étape 3 : l'adresse ---------------------------------------------------------

async function resolveEmail(input: {
  prospect: Prospect;
  contact: Contact;
  config: ResolvedCampaignConfig;
  providers: Providers;
  store: SourcingStore;
  stats: RunStats;
  now: () => Date;
  record: (step: string, error: unknown, prospect?: string) => void;
}): Promise<void> {
  const { prospect, contact, config, providers, store, stats, now, record } = input;
  const ttlMs = config.targeting.verification_ttl_days * 86_400_000;
  const stillFresh =
    contact.email !== null &&
    contact.email_verified_at !== null &&
    now().getTime() - new Date(contact.email_verified_at).getTime() < ttlMs;

  let result: Awaited<ReturnType<typeof findEmail>> = null;
  if (stillFresh) {
    result = { email: contact.email!, status: contact.email_status, provider: "pattern" };
  } else if (contact.first_name && contact.last_name) {
    result = await findEmail(
      {
        first_name: contact.first_name,
        last_name: contact.last_name,
        website: prospect.website,
        company_name: prospect.company_name,
      },
      {
        waterfall: config.targeting.enrichment_waterfall,
        finders: providers.email,
        verifier: providers.verifier,
        onError: (provider, error) => record(`email:${provider}`, error, prospect.company_name),
      },
    );
    if (result) {
      await store.updateContact(contact.id, {
        email: result.email,
        email_status: result.status,
        email_source: result.provider,
        email_verified_at: result.status === "unknown" ? null : isoNow(now),
      });
    }
  }

  if (result?.status === "valid") stats.email_valid += 1;
  else if (result?.status === "risky") stats.email_risky += 1;

  const contacts = await store.listContacts(prospect.id);
  const score = computeScore({
    prospect: { ads_active: prospect.ads_active, sector: prospect.sector, size_signal: prospect.size_signal },
    contacts,
    campaign: {
      filters: config.filters,
      reference_sector: config.filters.reference_sector,
      reference_size: config.filters.reference_size,
    },
  });
  await store.updateProspect(prospect.id, {
    score,
    enrichment: {
      ...prospect.enrichment,
      email_at: isoNow(now),
      email_provider: result && !stillFresh ? result.provider : (prospect.enrichment.email_provider ?? null),
    },
  });
}
