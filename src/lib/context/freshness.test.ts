import { describe, expect, it } from "vitest";

import {
  daysSince,
  firstDayOfMonth,
  isFactStale,
  isTemporalContextStale,
  monthlyInstructionState,
} from "./freshness";

const MAINTENANT = new Date("2026-09-11T10:00:00.000Z");

describe("daysSince", () => {
  it("compte les jours pleins écoulés", () => {
    expect(daysSince("2026-09-01T10:00:00.000Z", MAINTENANT)).toBe(10);
  });

  it("rend null sur une date absente ou illisible", () => {
    expect(daysSince(null, MAINTENANT)).toBeNull();
    expect(daysSince("hier", MAINTENANT)).toBeNull();
  });
});

describe("isFactStale", () => {
  it("laisse passer un fait vérifié il y a moins de six mois", () => {
    expect(isFactStale("2026-05-01", MAINTENANT)).toBe(false);
  });

  it("marque un fait vérifié il y a plus de six mois", () => {
    expect(isFactStale("2025-09-01", MAINTENANT)).toBe(true);
  });

  it("ne marque pas un fait sans date : non daté n'est pas périmé", () => {
    expect(isFactStale(null, MAINTENANT)).toBe(false);
  });
});

describe("isTemporalContextStale", () => {
  it("garde un rappel de moins de trente jours", () => {
    expect(isTemporalContextStale("2026-09-01T08:00:00.000Z", MAINTENANT)).toBe(false);
  });

  it("écarte un rappel de plus de trente jours", () => {
    expect(isTemporalContextStale("2026-07-01T08:00:00.000Z", MAINTENANT)).toBe(true);
  });

  it("écarte un rappel sans date : il ne décrit plus aucun moment", () => {
    expect(isTemporalContextStale(null, MAINTENANT)).toBe(true);
  });
});

describe("monthlyInstructionState", () => {
  it("dit « absente » quand rien n'est saisi", () => {
    expect(
      monthlyInstructionState({
        instruction: "   ",
        month: "2026-10-01",
        targetMonth: "2026-10-01",
      }),
    ).toBe("absente");
  });

  it("dit « active » quand la consigne vise le mois généré", () => {
    expect(
      monthlyInstructionState({
        instruction: "Insister sur la collection capsule.",
        month: "2026-10-01",
        targetMonth: "2026-10-01",
      }),
    ).toBe("active");
  });

  it("dit « périmée » quand la consigne vise un autre mois", () => {
    expect(
      monthlyInstructionState({
        instruction: "Insister sur les soldes.",
        month: "2026-08-01",
        targetMonth: "2026-10-01",
      }),
    ).toBe("perimee");
  });

  it("dit « périmée » quand la consigne n'a pas de mois : rien ne la juge", () => {
    expect(
      monthlyInstructionState({
        instruction: "Consigne orpheline.",
        month: null,
        targetMonth: "2026-10-01",
      }),
    ).toBe("perimee");
  });
});

describe("firstDayOfMonth", () => {
  it("cale la date au 1er du mois, en UTC", () => {
    expect(firstDayOfMonth(new Date("2026-01-31T23:30:00.000Z"))).toBe("2026-01-01");
  });
});
