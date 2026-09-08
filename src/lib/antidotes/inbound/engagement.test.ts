import { describe, expect, it } from "vitest";

import { engagementScore, formatEngagement, weightedInteractions } from "./engagement";

describe("engagementScore", () => {
  it("pèse commentaires et partages plus que les likes", () => {
    expect(weightedInteractions({ likes: 10, comments: 2, shares: 1 })).toBe(21);
  });

  it("rapporte aux abonnés du compte quand on les connaît", () => {
    const score = engagementScore({ likes: 100, comments: 10 }, 5000);
    expect(score.interactions).toBe(130);
    expect(score.perThousand).toBe(26);
    expect(score.relative).toBe(true);
    expect(score.sortKey).toBe(26);
  });

  it("retombe sur les abonnés relevés, puis sur l'absolu", () => {
    expect(engagementScore({ likes: 50, followers_at_collect: 1000 }, null).perThousand).toBe(50);
    const absolute = engagementScore({ likes: 50 }, null);
    expect(absolute).toMatchObject({ perThousand: null, sortKey: 50, relative: false });
  });

  it("s'affiche en pour mille ou en interactions", () => {
    expect(formatEngagement(engagementScore({ likes: 21 }, 5000))).toBe("4,2 ‰");
    expect(formatEngagement(engagementScore({ likes: 300 }, 5000))).toBe("60 ‰");
    expect(formatEngagement(engagementScore({ likes: 1 }, null))).toBe("1 interaction");
  });
});
