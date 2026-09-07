import { describe, expect, it } from "vitest";

import { formatDate, formatDateTime, relativeDays } from "./dates";

const NOW = new Date("2026-09-07T10:00:00.000Z");

describe("relativeDays", () => {
  it("rend un tiret sans date", () => {
    expect(relativeDays(null, NOW)).toBe("—");
    expect(relativeDays("pas une date", NOW)).toBe("—");
  });

  it("compte en heures sous vingt-quatre heures", () => {
    expect(relativeDays("2026-09-07T09:40:00.000Z", NOW)).toBe("à l'instant");
    expect(relativeDays("2026-09-07T07:00:00.000Z", NOW)).toBe("il y a 3 h");
  });

  it("dit hier puis compte en jours", () => {
    expect(relativeDays("2026-09-06T08:00:00.000Z", NOW)).toBe("hier");
    expect(relativeDays("2026-09-04T10:00:00.000Z", NOW)).toBe("il y a 3 j");
  });

  it("passe aux mois puis aux années", () => {
    expect(relativeDays("2026-07-01T10:00:00.000Z", NOW)).toBe("il y a 2 mois");
    expect(relativeDays("2024-01-01T10:00:00.000Z", NOW)).toBe("il y a 2 ans");
  });

  it("ne remonte pas dans le futur", () => {
    expect(relativeDays("2026-09-08T10:00:00.000Z", NOW)).toBe("à l'instant");
  });
});

describe("formatDateTime", () => {
  it("formate à l'heure de Paris", () => {
    expect(formatDateTime("2026-09-07T12:05:00.000Z")).toBe("7 sept. 2026, 14:05");
  });
});

describe("formatDate", () => {
  it("formate le jour seul, tiret sans date", () => {
    expect(formatDate("2026-09-07T12:05:00.000Z")).toBe("7 sept. 2026");
    expect(formatDate(null)).toBe("—");
  });
});
