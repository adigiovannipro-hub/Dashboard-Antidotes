import { describe, expect, it } from "vitest";

import type { Contact, Prospect, Sequence, SequenceEnrollment, SequenceStep } from "../types";
import {
  runSequencesPassage,
  type EnrollmentBundle,
  type InteractionInsert,
  type Mailer,
  type PassageStore,
} from "./passage";
import type { ThreadMessage } from "./replies";

const NOW = new Date("2026-09-08T08:00:00Z"); // mardi 10 h Paris
const OWN = "sandro@antidotes.fr";

const sequence = (overrides: Partial<Sequence> = {}): Sequence => ({
  id: "seq",
  org_id: "org",
  name: "Opticiens",
  description: null,
  is_active: true,
  settings: { case_study_url: "https://antidotes.fr/cas/bondet", sender_name: "Sandro" },
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  ...overrides,
});

const steps: SequenceStep[] = [
  { id: "s1", org_id: "org", sequence_id: "seq", position: 1, delay_days: 0, subject_template: "{{societe}}", body_template: "Bonjour {{prenom|à vous}}, {{observation|}} {{lien_case_study}} — {{expediteur}}", created_at: "" },
  { id: "s2", org_id: "org", sequence_id: "seq", position: 2, delay_days: 4, subject_template: "{{societe}}", body_template: "Relance {{prenom|à vous}}", created_at: "" },
];

const contact = (overrides: Partial<Contact> = {}): Contact => ({
  id: "c1",
  org_id: "org",
  prospect_id: "p1",
  first_name: "camille",
  last_name: "Roux",
  role: "Gérante",
  email: "camille@optique.fr",
  email_status: "valid",
  linkedin_url: null,
  phone: null,
  is_primary: true,
  seniority: "founder",
  discovery_source: "manual",
  email_source: null,
  email_verified_at: null,
  opted_out: false,
  opted_out_at: null,
  outreach_channel: "email",
  unsubscribe_token: "deadbeef",
  created_at: "",
  updated_at: "",
  ...overrides,
});

const prospect = (): Prospect => ({
  id: "p1",
  org_id: "org",
  campaign_id: null,
  source: "manual",
  company_name: "Optique Saint-Jean",
  website: null,
  country: "FR",
  city: "Lyon",
  sector: "Opticien",
  size_signal: {},
  ads_active: true,
  ads_last_seen_at: null,
  status: "qualified",
  score: 80,
  reference_client: null,
  notes: null,
  external_ids: {},
  last_contact_at: null,
  rating: null,
  phone: null,
  qualification: {},
  enrichment: {},
  last_run_id: null,
  created_at: "",
  updated_at: "",
});

const enrollment = (overrides: Partial<SequenceEnrollment> = {}): SequenceEnrollment => ({
  id: "e1",
  org_id: "org",
  sequence_id: "seq",
  contact_id: "c1",
  current_step: 0,
  status: "active",
  enrolled_at: "2026-09-08T07:00:00Z",
  next_send_at: "2026-09-08T07:00:00Z",
  channel: "email",
  personalization: { observation: "Vos pubs tournent depuis mars.", ready: true },
  thread_id: null,
  last_message_id: null,
  last_sent_at: null,
  replied_at: null,
  stopped_at: null,
  paused_reason: null,
  last_error: null,
  ...overrides,
});

type Fake = {
  store: PassageStore;
  saved: Record<string, Partial<SequenceEnrollment>[]>;
  interactions: InteractionInsert[];
  contacts: Record<string, Partial<Contact>>;
  advanced: string[];
};

function fakeStore(options: {
  due?: EnrollmentBundle[];
  threads?: EnrollmentBundle[];
  awaiting?: EnrollmentBundle[];
  sentToday?: number;
  window?: { sent: number; bounced: number };
}): Fake {
  const fake: Fake = { saved: {}, interactions: [], contacts: {}, advanced: [], store: null as never };
  fake.store = {
    async listThreadsToCheck() { return options.threads ?? []; },
    async listAwaitingPersonalization() { return options.awaiting ?? []; },
    async listDue() { return options.due ?? []; },
    async countSentSince() { return options.sentToday ?? 0; },
    async countBounceWindow() { return options.window ?? { sent: 0, bounced: 0 }; },
    async hasInteractionForMessage(id) { return fake.interactions.some((i) => i.payload.gmail_id === id); },
    async saveEnrollment(id, patch) { (fake.saved[id] ??= []).push(patch); },
    async saveContact(id, patch) { fake.contacts[id] = { ...fake.contacts[id], ...patch }; },
    async advanceProspect(id, status) { fake.advanced.push(`${id}:${status}`); },
    async addInteraction(row) { fake.interactions.push(row); },
  };
  return fake;
}

function fakeMailer(thread: ThreadMessage[] = []): Mailer & { sent: { mime: string; threadId: string | null }[] } {
  const sent: { mime: string; threadId: string | null }[] = [];
  return {
    ownAddress: OWN,
    sent,
    async send(message) { sent.push(message); return { id: `gm${sent.length}`, threadId: message.threadId ?? "thread-1" }; },
    async readThread() { return thread; },
  };
}

const bundle = (overrides: Partial<EnrollmentBundle> = {}): EnrollmentBundle => ({
  enrollment: enrollment(),
  contact: contact(),
  prospect: prospect(),
  sequence: sequence(),
  steps,
  ...overrides,
});

const run = (fake: Fake, mailer: Mailer | null, observer: Parameters<typeof runSequencesPassage>[0]["observer"] = null) =>
  runSequencesPassage({ store: fake.store, mailer, observer, siteUrl: "https://antidotes.fr", now: () => NOW, uuid: () => "u1" });

describe("runSequencesPassage — envois", () => {
  it("envoie la première étape, journalise, planifie la suivante et fait avancer le prospect", async () => {
    const fake = fakeStore({ due: [bundle()] });
    const mailer = fakeMailer();
    const report = await run(fake, mailer);

    expect(report.sent).toBe(1);
    expect(mailer.sent[0]!.threadId).toBeNull();
    expect(mailer.sent[0]!.mime).toContain("To: camille@optique.fr");
    expect(mailer.sent[0]!.mime).toContain("List-Unsubscribe: <https://antidotes.fr/desinscription/deadbeef>");
    const patch = fake.saved.e1![0]!;
    expect(patch).toMatchObject({ current_step: 1, status: "active", thread_id: "thread-1", last_message_id: "<u1@antidotes.fr>" });
    // J+4 depuis le mardi 8 = samedi → lundi 14 septembre, 9 h de Paris.
    expect(patch.next_send_at).toBe("2026-09-14T07:00:00.000Z");
    expect(fake.interactions[0]).toMatchObject({ type: "email_sent", payload: { step: 1, gmail_id: "gm1" } });
    expect(fake.advanced).toEqual(["p1:contacted"]);
  });

  it("relance dans le fil et termine à la dernière étape", async () => {
    const fake = fakeStore({
      due: [bundle({ enrollment: enrollment({ current_step: 1, thread_id: "t9", last_message_id: "<first@antidotes.fr>" }) })],
    });
    const mailer = fakeMailer();
    await run(fake, mailer);
    expect(mailer.sent[0]!.threadId).toBe("t9");
    expect(mailer.sent[0]!.mime).toContain("In-Reply-To: <first@antidotes.fr>");
    expect(mailer.sent[0]!.mime).toContain("Subject: Re: Optique Saint-Jean");
    expect(fake.saved.e1![0]).toMatchObject({ status: "completed", next_send_at: null });
  });

  it("met en pause avec la raison quand une variable manque, sans rien envoyer", async () => {
    const fake = fakeStore({ due: [bundle({ sequence: sequence({ settings: {} }) })] });
    const mailer = fakeMailer();
    const report = await run(fake, mailer);
    expect(report.paused).toBe(1);
    expect(mailer.sent).toHaveLength(0);
    expect(fake.saved.e1![0]).toMatchObject({ status: "paused", paused_reason: "Variables sans valeur : lien_case_study, expediteur." });
  });

  it("respecte le plafond quotidien et la fenêtre", async () => {
    const capped = fakeStore({ due: [bundle()], sentToday: 25 });
    expect((await run(capped, fakeMailer())).skipped).toBe(1);

    const night = fakeStore({ due: [bundle()] });
    const report = await runSequencesPassage({
      store: night.store, mailer: fakeMailer(), observer: null, siteUrl: "https://antidotes.fr",
      now: () => new Date("2026-09-08T20:00:00Z"), uuid: () => "u",
    });
    expect(report.skipped).toBe(1);
    expect(report.sent).toBe(0);
  });

  it("n'envoie rien quand la garde des rebonds bloque", async () => {
    const fake = fakeStore({ due: [bundle()], window: { sent: 50, bounced: 3 } });
    const mailer = fakeMailer();
    const report = await run(fake, mailer);
    expect(report.guard?.blocked).toBe(true);
    expect(report.blockedBy).toMatch(/Garde des rebonds/);
    expect(mailer.sent).toHaveLength(0);
  });

  it("dit l'absence de boîte plutôt que d'échouer", async () => {
    const report = await run(fakeStore({ due: [bundle()] }), null);
    expect(report.blockedBy).toBe("Aucune boîte Gmail connectée.");
  });
});

describe("runSequencesPassage — fils", () => {
  const sentEnrollment = enrollment({ current_step: 1, thread_id: "t1", last_sent_at: "2026-09-07T08:00:00Z", next_send_at: "2026-09-11T07:00:00Z" });
  const msg = (overrides: Partial<ThreadMessage>): ThreadMessage => ({
    id: "m", fromEmail: "camille@optique.fr", subject: "Re: Optique", autoSubmitted: null, precedence: null,
    receivedAt: new Date("2026-09-07T15:00:00Z"), snippet: "Intéressée !", ...overrides,
  });

  it("arrête la séquence sur une réponse et fait passer le prospect en « A répondu »", async () => {
    const fake = fakeStore({ threads: [bundle({ enrollment: sentEnrollment })] });
    const report = await run(fake, fakeMailer([msg({ id: "own", fromEmail: OWN }), msg({ id: "r1" })]));
    expect(report.replies).toBe(1);
    expect(fake.interactions[0]).toMatchObject({ type: "reply", payload: { gmail_id: "r1", snippet: "Intéressée !" } });
    expect(fake.saved.e1![0]).toMatchObject({ status: "stopped_on_reply", next_send_at: null });
    expect(fake.advanced).toEqual(["p1:replied"]);
  });

  it("invalide l'adresse sur un rebond et arrête l'inscription", async () => {
    const fake = fakeStore({ threads: [bundle({ enrollment: sentEnrollment })] });
    const report = await run(fake, fakeMailer([msg({ id: "b1", fromEmail: "mailer-daemon@googlemail.com", subject: "Delivery Status Notification (Failure)" })]));
    expect(report.bounces).toBe(1);
    expect(fake.contacts.c1).toEqual({ email_status: "invalid" });
    expect(fake.saved.e1![0]).toMatchObject({ status: "paused", paused_reason: "Adresse rebondie : plus aucun envoi." });
  });

  it("note un répondeur d'absence sans s'arrêter, une seule fois", async () => {
    const fake = fakeStore({ threads: [bundle({ enrollment: sentEnrollment })] });
    const mailer = fakeMailer([msg({ id: "a1", autoSubmitted: "auto-replied", subject: "Réponse automatique" })]);
    await run(fake, mailer);
    const again = await run(fake, mailer);
    expect(fake.interactions.filter((i) => i.type === "note")).toHaveLength(1);
    expect(again.autoReplies).toBe(0);
    expect(fake.saved.e1).toBeUndefined();
  });
});

describe("runSequencesPassage — observations", () => {
  it("écrit l'observation trouvée, ou un manque qui ne bloque pas", async () => {
    const fake = fakeStore({
      awaiting: [
        bundle({ enrollment: enrollment({ id: "e1", personalization: {} }) }),
        bundle({ enrollment: enrollment({ id: "e2", personalization: {} }) }),
      ],
    });
    let calls = 0;
    const report = await run(fake, null, async () => {
      calls += 1;
      if (calls === 2) throw new Error("modèle indisponible");
      return { observation: "Vos vitrines changent chaque saison.", source: "site" };
    });
    expect(report.personalized).toBe(1);
    expect(fake.saved.e1![0]!.personalization).toMatchObject({ observation: "Vos vitrines changent chaque saison.", ready: true });
    expect(fake.saved.e2![0]!.personalization).toMatchObject({ observation: null, ready: true, error: "modèle indisponible" });
  });
});
