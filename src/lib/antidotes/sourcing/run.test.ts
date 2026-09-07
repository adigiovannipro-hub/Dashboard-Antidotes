import { describe, expect, it } from "vitest";

import type { Campaign, CampaignRun, Contact, Prospect } from "../types";
import type { Providers } from "./providers";
import { runCampaign, type ContactInsert, type ProspectInsert, type SourcingStore } from "./run";

/* Une base en mémoire, juste assez fidèle pour rejouer un passage entier. */
function memoryStore() {
  const prospects = new Map<string, Prospect>();
  const contacts = new Map<string, Contact>();
  const runs = new Map<string, Partial<CampaignRun>>();
  const campaigns = new Map<string, Partial<Campaign>>();
  let sequence = 0;
  const id = () => `id-${(sequence += 1)}`;
  const stamp = "2026-09-08T10:00:00.000Z";

  const store: SourcingStore = {
    async saveRun(runId, patch) {
      runs.set(runId, { ...(runs.get(runId) ?? {}), ...patch });
    },
    async saveCampaign(campaignId, patch) {
      campaigns.set(campaignId, { ...(campaigns.get(campaignId) ?? {}), ...patch });
    },
    async findProspectByExternalId(orgId, key, value) {
      return (
        [...prospects.values()].find((row) => row.org_id === orgId && row.external_ids[key] === value) ?? null
      );
    },
    async insertProspect(row: ProspectInsert) {
      const created: Prospect = { ...row, id: id(), created_at: stamp, updated_at: stamp };
      prospects.set(created.id, created);
      return created;
    },
    async updateProspect(prospectId, patch) {
      prospects.set(prospectId, { ...prospects.get(prospectId)!, ...patch });
    },
    async listProspectsAwaitingDiscovery(runId) {
      return [...prospects.values()].filter(
        (row) => row.last_run_id === runId && row.status === "qualified" && !row.enrichment.discovery_at,
      );
    },
    async listProspectsAwaitingEmail(runId) {
      return [...prospects.values()]
        .filter((row) => row.last_run_id === runId && !row.enrichment.email_at)
        .flatMap((prospect) => {
          const contact = [...contacts.values()].find((c) => c.prospect_id === prospect.id && c.is_primary);
          return contact ? [{ prospect, contact }] : [];
        });
    },
    async listContacts(prospectId) {
      return [...contacts.values()].filter((c) => c.prospect_id === prospectId);
    },
    async insertContact(row: ContactInsert) {
      const created: Contact = {
        ...row,
        id: id(),
        created_at: stamp,
        updated_at: stamp,
        outreach_channel: row.email_status === "valid" ? "email" : row.email_status === "risky" ? "linkedin" : "none",
      };
      contacts.set(created.id, created);
      return created;
    },
    async updateContact(contactId, patch) {
      const current = contacts.get(contactId)!;
      const next = { ...current, ...patch };
      next.outreach_channel =
        next.email_status === "valid" ? "email" : next.email_status === "risky" ? "linkedin" : "none";
      contacts.set(contactId, next);
    },
  };

  return { store, prospects, contacts, runs, campaigns };
}

const campaign: Campaign = {
  id: "camp-1",
  org_id: "org-1",
  name: "Opticiens Lyon",
  engine: "maps",
  reference_client: "Bondet",
  source_params: { keywords: ["opticien"], cities: ["Lyon"] },
  filters: { reference_size: { reviews_count: 100 }, reference_sector: "Opticien", min_rating: 4 },
  targeting: {},
  is_active: true,
  last_run_at: null,
  stats: {},
  created_at: "2026-09-08T09:00:00.000Z",
  updated_at: "2026-09-08T09:00:00.000Z",
};

const run: CampaignRun = {
  id: "run-1",
  org_id: "org-1",
  campaign_id: "camp-1",
  status: "queued",
  stage: "sourcing",
  stats: {},
  errors: [],
  requested_at: "2026-09-08T09:59:00.000Z",
  started_at: null,
  finished_at: null,
  heartbeat_at: null,
  created_at: "2026-09-08T09:59:00.000Z",
};

const company = (name: string, overrides: Record<string, unknown> = {}) => ({
  company_name: name,
  website: `https://${name.toLowerCase().replace(/\s+/g, "-")}.fr`,
  country: "FR",
  city: "Lyon",
  postal_code: "69001",
  sector: "Opticien",
  rating: 4.5,
  reviews_count: 110,
  phone: null,
  external_ids: { place_id: `place-${name}` },
  ...overrides,
});

function providers(overrides: Partial<Providers> = {}): Providers {
  return {
    engines: {
      maps: async () => [
        company("Optique A"),
        company("Optique B", { rating: 3.1 }),
        company("Optique C", { reviews_count: 400 }),
        company("Optique D"),
      ],
    },
    ads: async ({ company_name }) => ({ active: company_name !== "Optique D", last_seen_at: "2026-09-01" }),
    discovery: {
      legal_registry: async ({ company_name }) => ({
        people:
          company_name === "Optique A"
            ? [{ first_name: "Camille", last_name: "Roux", role: "Gérant", source: "legal_registry" as const }]
            : [],
        employees: 8,
        siren: "123",
      }),
    },
    email: {
      hunter: async ({ last_name }) => ({
        email: `${last_name.toLowerCase()}@optique-a.fr`,
        status: "valid" as const,
        provider: "hunter" as const,
      }),
    },
    verifier: null,
    missing: [],
    ...overrides,
  };
}

const clock = (iso = "2026-09-08T10:00:00.000Z") => () => new Date(iso);
const later = new Date("2026-09-08T11:00:00.000Z");

describe("runCampaign", () => {
  it("rejoue la chaîne entière : sourcer, qualifier, décideur, adresse, score", async () => {
    const memory = memoryStore();
    const report = await runCampaign({
      store: memory.store,
      providers: providers(),
      campaign,
      run,
      now: clock(),
      deadline: later,
    });

    expect(report.status).toBe("done");
    expect(report.stage).toBe("done");
    // B rejetée sur la note, C sur la taille, D sans pubs : seule A passe.
    expect(report.stats.sourced).toBe(4);
    expect(report.stats.qualified).toBe(1);
    expect(report.stats.rejected).toEqual({
      "note trop basse": 1,
      "taille hors tolérance": 1,
      "sans publicité active": 1,
    });
    expect(report.stats.contact_found).toBe(1);
    expect(report.stats.email_valid).toBe(1);

    const [prospect] = [...memory.prospects.values()];
    expect(prospect?.status).toBe("qualified");
    expect(prospect?.external_ids).toEqual({ place_id: "place-Optique A", siren: "123" });
    expect(prospect?.size_signal).toEqual({ reviews_count: 110, employees: 8 });
    // 40 pubs + 30 taille + 20 contact joignable + 10 secteur.
    expect(prospect?.score).toBe(100);

    const [contact] = [...memory.contacts.values()];
    expect(contact).toMatchObject({
      first_name: "Camille",
      last_name: "Roux",
      email: "roux@optique-a.fr",
      email_status: "valid",
      email_source: "hunter",
      discovery_source: "legal_registry",
      is_primary: true,
    });
    expect(memory.campaigns.get("camp-1")?.stats?.email_valid).toBe(1);
  });

  it("envoie en revue quand les publicités ne peuvent pas être vérifiées", async () => {
    const memory = memoryStore();
    const report = await runCampaign({
      store: memory.store,
      providers: providers({ ads: null, engines: { maps: async () => [company("Optique A")] } }),
      campaign,
      run,
      now: clock(),
      deadline: later,
    });
    expect(report.stats.to_review).toBe(1);
    expect(report.stats.qualified).toBe(0);
    const [prospect] = [...memory.prospects.values()];
    expect(prospect?.status).toBe("to_qualify");
    expect(prospect?.qualification.reasons).toEqual(["publicités non vérifiées"]);
    // Pas encore qualifié : pas de décisionnaire cherché.
    expect(memory.contacts.size).toBe(0);
  });

  it("sort du flux sans décisionnaire, et journalise l'échec d'une source", async () => {
    const memory = memoryStore();
    const report = await runCampaign({
      store: memory.store,
      providers: providers({
        engines: { maps: async () => [company("Optique A")] },
        discovery: {
          linkedin: async () => {
            throw new Error("quota Apify");
          },
          legal_registry: async () => ({ people: [] }),
        },
      }),
      campaign,
      run,
      now: clock(),
      deadline: later,
    });
    expect(report.stats.contact_found).toBe(0);
    expect(report.errors.map((error) => error.step)).toEqual(["decisionnaire:linkedin"]);
    const [prospect] = [...memory.prospects.values()];
    expect(prospect?.status).toBe("no_contact_found");
    expect(prospect?.enrichment.errors?.[0]).toContain("quota Apify");
  });

  it("met le passage en erreur si le moteur échoue ou n'est pas branché", async () => {
    const memory = memoryStore();
    const broken = await runCampaign({
      store: memory.store,
      providers: providers({
        engines: {
          maps: async () => {
            throw new Error("Apify Google Maps : 402 insufficient credit");
          },
        },
      }),
      campaign,
      run,
      now: clock(),
      deadline: later,
    });
    expect(broken.status).toBe("error");
    expect(broken.errors[0]?.message).toContain("402");

    const unplugged = await runCampaign({
      store: memory.store,
      providers: providers({ engines: {} }),
      campaign: { ...campaign, engine: "ecommerce", source_params: { category: "mode" } },
      run,
      now: clock(),
      deadline: later,
    });
    expect(unplugged.status).toBe("error");
    expect(unplugged.errors[0]?.message).toContain("ecommerce");
  });

  it("s'interrompt au budget et reprend au passage suivant", async () => {
    const memory = memoryStore();
    let ticks = 0;
    // Chaque lecture de l'horloge avance de vingt minutes : la première
    // vérification du budget passe, la seconde non.
    const now = () => new Date(Date.UTC(2026, 8, 8, 10, ticks++ * 20));
    const first = await runCampaign({
      store: memory.store,
      providers: providers({ engines: { maps: async () => [company("Optique A"), company("Optique E")] } }),
      campaign,
      run,
      now,
      deadline: new Date(Date.UTC(2026, 8, 8, 12, 0)),
    });
    expect(first.interrupted).toBe(true);
    expect(first.status).toBe("running");

    const resumed = await runCampaign({
      store: memory.store,
      providers: providers({ engines: { maps: async () => [] } }),
      campaign,
      run: { ...run, ...memory.runs.get("run-1"), status: "running" } as CampaignRun,
      now: clock(),
      deadline: later,
    });
    expect(resumed.status).toBe("done");
    // Les deux sociétés ont été admises une fois ; le moteur n'a pas été rappelé.
    expect(memory.prospects.size).toBe(2);
    expect(resumed.stats.sourced).toBe(2);
  });

  it("rafraîchit une société déjà connue sans la dupliquer ni la faire reculer", async () => {
    const memory = memoryStore();
    const known = await memory.store.insertProspect({
      org_id: "org-1",
      campaign_id: null,
      source: "manual",
      company_name: "Optique A",
      website: null,
      country: "FR",
      city: "Lyon",
      sector: "Opticien",
      size_signal: {},
      ads_active: false,
      ads_last_seen_at: null,
      status: "contacted",
      score: 0,
      reference_client: null,
      notes: "Déjà appelée.",
      external_ids: { place_id: "place-Optique A" },
      last_contact_at: null,
      rating: null,
      phone: null,
      qualification: {},
      enrichment: {},
      last_run_id: null,
    });
    await runCampaign({
      store: memory.store,
      providers: providers({ engines: { maps: async () => [company("Optique A")] } }),
      campaign,
      run,
      now: clock(),
      deadline: later,
    });
    expect(memory.prospects.size).toBe(1);
    const refreshed = memory.prospects.get(known.id)!;
    expect(refreshed.status).toBe("contacted");
    expect(refreshed.notes).toBe("Déjà appelée.");
    expect(refreshed.rating).toBe(4.5);
    expect(refreshed.campaign_id).toBe("camp-1");
    expect(refreshed.last_run_id).toBe("run-1");
  });
});
