import { describe, expect, it } from "vitest";

import { buildCalendarMonth, dayKeyOf, groupByDay, monthKeyOf, parseMonthKey } from "./calendar";

describe("buildCalendarMonth", () => {
  it("commence la grille au lundi qui précède le 1er", () => {
    // 1er septembre 2026 est un mardi : la grille ouvre le lundi 31 août.
    const month = buildCalendarMonth("2026-09");
    expect(month.label).toBe("septembre 2026");
    expect(month.weeks[0]![0]).toEqual({ date: "2026-08-31", day: 31, inMonth: false });
    expect(month.weeks[0]![1]).toEqual({ date: "2026-09-01", day: 1, inMonth: true });
  });

  it("ne recule pas d'une semaine entière quand le 1er tombe un dimanche", () => {
    // 1er février 2026 est un dimanche : six jours de janvier le précèdent.
    const month = buildCalendarMonth("2026-02");
    expect(month.weeks[0]![0].date).toBe("2026-01-26");
    expect(month.weeks[0]![6]).toEqual({ date: "2026-02-01", day: 1, inMonth: true });
  });

  it("couvre le mois entier sans traîner de semaine vide", () => {
    for (const key of ["2026-01", "2026-02", "2026-08", "2026-09", "2027-02"]) {
      const month = buildCalendarMonth(key);
      const days = month.weeks.flat().filter((day) => day.inMonth);
      const last = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0)).getUTCDate();
      expect(days).toHaveLength(last);
      expect(month.weeks[month.weeks.length - 1]!.some((day) => day.inMonth)).toBe(true);
    }
  });

  it("nomme le mois d'avant et celui d'après, année comprise", () => {
    expect(buildCalendarMonth("2026-01").previous).toBe("2025-12");
    expect(buildCalendarMonth("2026-12").next).toBe("2027-01");
  });
});

describe("parseMonthKey", () => {
  it("refuse une forme invalide et retombe sur le mois du repère", () => {
    const fallback = new Date("2026-09-09T00:00:00Z");
    expect(parseMonthKey("2026-03", fallback)).toBe("2026-03");
    expect(parseMonthKey("2026-13", fallback)).toBe("2026-09");
    expect(parseMonthKey(undefined, fallback)).toBe("2026-09");
    expect(parseMonthKey("septembre", fallback)).toBe("2026-09");
  });
});

describe("groupByDay", () => {
  it("range par jour et ignore ce qui n'a pas de date", () => {
    const items = [
      { id: "a", at: "2026-09-03T14:00:00Z" },
      { id: "b", at: "2026-09-03T08:00:00Z" },
      { id: "c", at: null },
    ];
    const byDay = groupByDay(items, (item) => item.at);
    expect(byDay.get("2026-09-03")?.map((item) => item.id)).toEqual(["a", "b"]);
    expect(byDay.size).toBe(1);
  });
});

describe("monthKeyOf / dayKeyOf", () => {
  it("lisent en UTC", () => {
    expect(monthKeyOf("2026-09-30T23:30:00Z")).toBe("2026-09");
    expect(dayKeyOf("2026-09-30T23:30:00Z")).toBe("2026-09-30");
  });
});
