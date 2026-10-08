import { describe, expect, it } from "vitest";

import { buildIcs } from "./ics";

describe("buildIcs", () => {
  const event = {
    uid: "abc@antidotes.agency",
    start: new Date("2026-10-12T07:00:00.000Z"),
    end: new Date("2026-10-12T07:30:00.000Z"),
    summary: "Antidotes × Marie Dupont — visio",
    description: "Lien : https://meet.google.com/abc-defg-hij\nÀ bientôt ; merci, Alessandro",
    location: "https://meet.google.com/abc-defg-hij",
    url: "https://meet.google.com/abc-defg-hij",
    organizer: { name: "Alessandro Di Giovanni", email: "a@example.com" },
    attendee: { name: "Marie Dupont", email: "marie@example.com" },
    stamp: new Date("2026-10-01T00:00:00.000Z"),
  };

  it("écrit les instants en UTC et échappe le texte", () => {
    const ics = buildIcs(event).replace(/\r\n /g, "");
    expect(ics).toContain("DTSTART:20261012T070000Z");
    expect(ics).toContain("DTEND:20261012T073000Z");
    expect(ics).toContain("METHOD:REQUEST");
    expect(ics).toContain("STATUS:CONFIRMED");
    expect(ics).toContain("\\nÀ bientôt \; merci\\, Alessandro");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("plie les lignes longues à 75 octets", () => {
    const ics = buildIcs({ ...event, description: "x".repeat(200) });
    for (const line of ics.split("\r\n")) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    }
  });

  it("sait annuler", () => {
    const ics = buildIcs({ ...event, method: "CANCEL", sequence: 1 });
    expect(ics).toContain("METHOD:CANCEL");
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics).toContain("SEQUENCE:1");
  });
});
