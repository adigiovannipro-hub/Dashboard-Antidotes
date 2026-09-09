import { describe, expect, it } from "vitest";

import { buildSequenceFunnel, computeSequenceCounts, evaluateBounceGuard, sumSequenceCounts } from "./stats";

describe("computeSequenceCounts", () => {
  it("compte les inscriptions par état et le taux de réponse sur les contactés", () => {
    const counts = computeSequenceCounts(
      [
        { status: "active", channel: "email" },
        { status: "stopped_on_reply", channel: "email" },
        { status: "completed", channel: "email" },
        { status: "active", channel: "linkedin" },
        { status: "stopped_on_opt_out", channel: "email" },
      ],
      [
        { type: "email_sent" },
        { type: "email_sent" },
        { type: "email_sent" },
        { type: "reply" },
        { type: "bounce" },
        { type: "note" },
      ],
      4,
    );
    expect(counts).toMatchObject({
      enrolled: 5,
      active: 2,
      completed: 1,
      stoppedOnReply: 1,
      stoppedOnOptOut: 1,
      linkedin: 1,
      sent: 3,
      replied: 1,
      bounced: 1,
      replyRate: 0.25,
    });
  });

  it("n'invente pas de taux sans envoi", () => {
    expect(computeSequenceCounts([], [], 0).replyRate).toBeNull();
  });

  /* Le nombre de contactés est rendu tel quel, jamais à redériver d'un taux :
     une séquence qui a envoyé sans réponse a un taux de 0, et retrouver les
     contactés en divisant les réponses par ce taux donne NaN — la page de
     liste affichait alors « aucun contacté » avec des envois au compteur. */
  it("rend les contactés même quand personne n'a répondu", () => {
    const counts = computeSequenceCounts(
      [{ status: "active", channel: "email" }, { status: "active", channel: "email" }],
      [{ type: "email_sent" }, { type: "email_sent" }],
      2,
    );
    expect(counts.contacted).toBe(2);
    expect(counts.replyRate).toBe(0);
  });

  /* Les marches de l'entonnoir sont des personnes : « Ont répondu » se lit
     sur `replied_at` de l'inscription et non sur le nombre de messages reçus
     — une même personne peut répondre deux fois — et « Rendez-vous » sur le
     statut du prospect, gagné compris. Une inscription dont la lecture n'a
     pas joint le prospect ne compte pas : rien n'est deviné. */
  it("compte les personnes qui ont répondu et celles en rendez-vous ou gagnées", () => {
    const counts = computeSequenceCounts(
      [
        { status: "stopped_on_reply", channel: "email", replied_at: "2026-09-01T10:00:00Z", prospect_status: "meeting" },
        { status: "stopped_on_reply", channel: "email", replied_at: "2026-09-02T10:00:00Z", prospect_status: "won" },
        { status: "stopped_on_reply", channel: "email", replied_at: "2026-09-03T10:00:00Z", prospect_status: "replied" },
        { status: "active", channel: "email", replied_at: null, prospect_status: "contacted" },
        { status: "active", channel: "email", prospect_status: "lost" },
        { status: "active", channel: "linkedin" },
      ],
      [{ type: "reply" }, { type: "reply" }, { type: "reply" }, { type: "reply" }],
      5,
    );
    expect(counts.responded).toBe(3);
    expect(counts.meetings).toBe(2);
    expect(counts.replied).toBe(4);
  });
});

describe("sumSequenceCounts", () => {
  it("additionne les compteurs et recalcule le taux sur les agrégats", () => {
    const a = computeSequenceCounts(
      [{ status: "active", channel: "email", replied_at: "2026-09-01T10:00:00Z", prospect_status: "meeting" }],
      [{ type: "email_sent" }, { type: "reply" }],
      1,
    );
    const b = computeSequenceCounts(
      [{ status: "active", channel: "email" }, { status: "active", channel: "email" }, { status: "paused", channel: "email" }],
      [{ type: "email_sent" }, { type: "email_sent" }, { type: "email_sent" }, { type: "bounce" }],
      3,
    );
    expect(sumSequenceCounts([a, b])).toMatchObject({
      enrolled: 4,
      active: 3,
      paused: 1,
      sent: 4,
      replied: 1,
      bounced: 1,
      contacted: 4,
      responded: 1,
      meetings: 1,
      replyRate: 0.25,
    });
  });

  it("rend des zéros et aucun taux sans séquence", () => {
    expect(sumSequenceCounts([])).toMatchObject({ enrolled: 0, contacted: 0, replyRate: null });
  });
});

describe("buildSequenceFunnel", () => {
  const base = computeSequenceCounts([], [], 0);

  it("pose quatre marches en personnes, chacune avec son taux de passage depuis la précédente", () => {
    const steps = buildSequenceFunnel({ ...base, enrolled: 9, contacted: 7, responded: 2, meetings: 1 });
    expect(steps.map((step) => [step.label, step.value, step.passage])).toEqual([
      ["Inscrits", 9, 1],
      ["Contactés", 7, 7 / 9],
      ["Ont répondu", 2, 2 / 7],
      ["Rendez-vous", 1, 1 / 2],
    ]);
  });

  /* Sans contacté, « 0 réponse » n'est pas un taux de 0 % : la marche
     précédente est vide, il n'y a rien à rapporter. Le taux vaut `null` et
     s'affiche « — ». La première marche, elle, est toujours à 100 %. */
  it("ne rend pas de taux quand la marche précédente est à zéro", () => {
    const steps = buildSequenceFunnel({ ...base, enrolled: 3 });
    expect(steps.map((step) => step.passage)).toEqual([1, 0, null, null]);
    expect(buildSequenceFunnel(base)[0].passage).toBe(1);
  });
});

describe("evaluateBounceGuard", () => {
  it("bloque au-delà de 3 % passé vingt envois", () => {
    expect(evaluateBounceGuard(100, 4).blocked).toBe(true);
    expect(evaluateBounceGuard(100, 3).blocked).toBe(false);
  });

  it("ne juge pas un petit volume", () => {
    expect(evaluateBounceGuard(3, 1)).toMatchObject({ rate: 1 / 3, blocked: false });
    expect(evaluateBounceGuard(0, 0).rate).toBeNull();
  });
});
