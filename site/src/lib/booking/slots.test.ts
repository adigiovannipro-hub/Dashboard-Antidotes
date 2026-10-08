import { describe, expect, it } from "vitest";

import { DEFAULT_AVAILABILITY, freeSlots, groupByLocalDay, isOfferedSlot } from "./slots";
import { offsetMs, wallClock, zonedToUtc } from "./timezone";

const config = { ...DEFAULT_AVAILABILITY, minNoticeHours: 0, horizonDays: 60 };

describe("zonedToUtc", () => {
  it("convertit une heure de Bali (UTC+8, sans heure d'été) en UTC", () => {
    const utc = zonedToUtc("Asia/Makassar", { year: 2026, month: 10, day: 12, hour: 15, minute: 0 });
    expect(utc.toISOString()).toBe("2026-10-12T07:00:00.000Z");
  });

  it("suit le changement d'heure de Paris", () => {
    const summer = zonedToUtc("Europe/Paris", { year: 2026, month: 10, day: 20, hour: 9, minute: 0 });
    const winter = zonedToUtc("Europe/Paris", { year: 2026, month: 10, day: 27, hour: 9, minute: 0 });
    expect(summer.toISOString()).toBe("2026-10-20T07:00:00.000Z");
    expect(winter.toISOString()).toBe("2026-10-27T08:00:00.000Z");
  });

  it("rend l'heure murale et le décalage d'un instant", () => {
    const instant = new Date("2026-10-12T07:30:00.000Z");
    expect(wallClock(instant, "Asia/Makassar")).toMatchObject({ hour: 15, minute: 30, weekday: 1 });
    expect(offsetMs(instant, "Asia/Makassar")).toBe(8 * 3_600_000);
    expect(wallClock(instant, "America/New_York")).toMatchObject({ hour: 3, minute: 30 });
  });
});

describe("freeSlots", () => {
  const monday = new Date("2026-10-12T00:00:00.000Z");
  const week = new Date("2026-10-19T00:00:00.000Z");

  it("rend douze créneaux de 30 min par jour ouvré, 15h–21h à Bali", () => {
    const slots = freeSlots({ config, from: monday, to: week, now: new Date("2026-10-01T00:00:00Z"), busy: [] });
    expect(slots).toHaveLength(5 * 12);
    expect(slots[0]!.start.toISOString()).toBe("2026-10-12T07:00:00.000Z");
    expect(slots[11]!.start.toISOString()).toBe("2026-10-12T12:30:00.000Z");
    expect(slots.every((s) => wallClock(s.start, "Asia/Makassar").weekday !== 0)).toBe(true);
  });

  it("retire les créneaux qui touchent une plage occupée, marge comprise", () => {
    const busy = [{ start: new Date("2026-10-12T08:00:00.000Z"), end: new Date("2026-10-12T08:30:00.000Z") }];
    const slots = freeSlots({ config, from: monday, to: week, now: new Date("2026-10-01T00:00:00Z"), busy });
    const starts = slots.map((s) => s.start.toISOString());
    expect(starts).not.toContain("2026-10-12T08:00:00.000Z");
    // 07:30–08:00 colle à 08:00 avec la marge de 15 min : retiré aussi.
    expect(starts).not.toContain("2026-10-12T07:30:00.000Z");
    expect(starts).not.toContain("2026-10-12T08:30:00.000Z");
    expect(starts).toContain("2026-10-12T09:00:00.000Z");
  });

  it("respecte le délai minimal et l'horizon", () => {
    const now = new Date("2026-10-12T06:00:00.000Z");
    const slots = freeSlots({ config: { ...config, minNoticeHours: 24, horizonDays: 2 }, from: monday, to: week, now, busy: [] });
    expect(slots[0]!.start.getTime()).toBeGreaterThanOrEqual(now.getTime() + 24 * 3_600_000);
    expect(slots.at(-1)!.start.getTime()).toBeLessThan(now.getTime() + 2 * 86_400_000);
  });

  it("ne rend rien hors des jours ouverts", () => {
    const saturday = new Date("2026-10-17T00:00:00.000Z");
    const sunday = new Date("2026-10-19T00:00:00.000Z");
    expect(freeSlots({ config, from: saturday, to: sunday, now: new Date("2026-10-01T00:00:00Z"), busy: [] })).toEqual([]);
  });
});

describe("groupByLocalDay", () => {
  it("groupe par jour civil du prospect — un créneau de 21h à Bali est encore la matinée à New York", () => {
    const slots = freeSlots({ config, from: new Date("2026-10-12T00:00:00Z"), to: new Date("2026-10-13T00:00:00Z"), now: new Date("2026-10-01T00:00:00Z"), busy: [] });
    const ny = groupByLocalDay(slots, "America/New_York");
    expect(ny).toHaveLength(1);
    expect(ny[0]!.day).toBe("2026-10-12");
    const paris = groupByLocalDay(slots, "Europe/Paris");
    expect(paris[0]!.day).toBe("2026-10-12");
  });
});

describe("isOfferedSlot", () => {
  it("ne reconnaît qu'un créneau exact", () => {
    const slots = freeSlots({ config, from: new Date("2026-10-12T00:00:00Z"), to: new Date("2026-10-13T00:00:00Z"), now: new Date("2026-10-01T00:00:00Z"), busy: [] });
    expect(isOfferedSlot(slots, new Date("2026-10-12T07:00:00.000Z"))).toBe(true);
    expect(isOfferedSlot(slots, new Date("2026-10-12T07:10:00.000Z"))).toBe(false);
  });
});
