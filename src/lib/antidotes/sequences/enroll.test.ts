import { describe, expect, it } from "vitest";

import { DEFAULT_SEND_WINDOW } from "./schedule";
import { decideEnrollment, linkedinTaskKey, linkedinTaskTitle } from "./enroll";

const now = new Date("2026-09-08T08:00:00Z"); // mardi 10 h Paris
const steps = [{ delay_days: 0 }, { delay_days: 4 }];

describe("decideEnrollment", () => {
  it("inscrit une adresse valide au premier envoi, dans la fenêtre", () => {
    const decision = decideEnrollment({
      contact: { email: "a@b.fr", email_status: "valid", opted_out: false, outreach_channel: "email" },
      steps,
      window: DEFAULT_SEND_WINDOW,
      now,
    });
    expect(decision).toEqual({ ok: true, channel: "email", next_send_at: "2026-09-08T08:00:00.000Z" });
  });

  it("route une adresse risquée vers LinkedIn, sans calendrier", () => {
    expect(
      decideEnrollment({
        contact: { email: "a@b.fr", email_status: "risky", opted_out: false, outreach_channel: "linkedin" },
        steps,
        window: DEFAULT_SEND_WINDOW,
        now,
      }),
    ).toEqual({ ok: true, channel: "linkedin", next_send_at: null });
  });

  it("refuse le désinscrit, l'invalide, le non vérifié et le sans adresse, chacun avec sa raison", () => {
    const base = { steps, window: DEFAULT_SEND_WINDOW, now } as const;
    expect(decideEnrollment({ ...base, contact: { email: "a@b.fr", email_status: "valid", opted_out: true, outreach_channel: "email" } }))
      .toEqual({ ok: false, reason: "contact désinscrit" });
    expect(decideEnrollment({ ...base, contact: { email: "a@b.fr", email_status: "invalid", opted_out: false, outreach_channel: "none" } }))
      .toEqual({ ok: false, reason: "adresse invalide" });
    expect(decideEnrollment({ ...base, contact: { email: "a@b.fr", email_status: "unknown", opted_out: false, outreach_channel: "none" } }))
      .toEqual({ ok: false, reason: "adresse non vérifiée" });
    expect(decideEnrollment({ ...base, contact: { email: null, email_status: "unknown", opted_out: false, outreach_channel: "none" } }))
      .toEqual({ ok: false, reason: "sans adresse" });
  });

  it("refuse une séquence sans étape", () => {
    expect(
      decideEnrollment({
        contact: { email: "a@b.fr", email_status: "valid", opted_out: false, outreach_channel: "email" },
        steps: [],
        window: DEFAULT_SEND_WINDOW,
        now,
      }),
    ).toEqual({ ok: false, reason: "séquence sans étape" });
  });
});

describe("linkedinTask*", () => {
  it("forme une clé stable et un titre lisible", () => {
    expect(linkedinTaskKey("e1")).toBe("antidotes:linkedin:e1");
    expect(linkedinTaskTitle({ contactName: "Yanis Bel", companyName: "Grimpe Indoor" })).toBe(
      "LinkedIn · Yanis Bel (Grimpe Indoor)",
    );
  });
});
