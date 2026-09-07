import { describe, expect, it } from "vitest";

import { computeSequenceCounts, evaluateBounceGuard } from "./stats";

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
