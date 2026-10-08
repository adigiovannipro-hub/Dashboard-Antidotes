import { describe, expect, it } from "vitest";

import { bulkSchedulingRefusal, schedulingRefusal } from "./scheduling-guard";

// 18h10 à Bali, 12h10 à Paris le 8 octobre.
const now = new Date("2026-10-08T10:10:00Z");
const line = (scheduled_on: string | null, status = "scheduled", name = "MADDY RENTRÉE") => ({
  name,
  status,
  scheduled_on,
});

describe("schedulingRefusal", () => {
  it("refuse une ligne programmée sur une date passée, en nommant la sortie", () => {
    expect(schedulingRefusal(line("2026-10-07"), now)).toBe(
      "« MADDY RENTRÉE » est antidatée (07/10/2026) : change sa date ou publie-la maintenant.",
    );
  });

  it("refuse une ligne programmée sans date", () => {
    expect(schedulingRefusal(line(null), now)).toBe(
      "« MADDY RENTRÉE » n'a pas de date : choisis-en une pour la programmer.",
    );
  });

  it("laisse passer aujourd'hui et les jours à venir", () => {
    expect(schedulingRefusal(line("2026-10-08"), now)).toBeNull();
    expect(schedulingRefusal(line("2026-10-14"), now)).toBeNull();
  });

  it("ne juge que les lignes programmées", () => {
    expect(schedulingRefusal(line("2026-10-07", "validated"), now)).toBeNull();
    expect(schedulingRefusal(line("2026-10-07", "published"), now)).toBeNull();
  });

  it("juge la date de Paris : à 23h30 le 8 à Paris, le 8 est encore aujourd'hui", () => {
    expect(schedulingRefusal(line("2026-10-08"), new Date("2026-10-08T21:30:00Z"))).toBeNull();
    // 00h30 à Paris le 9 : le 8 est passé.
    expect(schedulingRefusal(line("2026-10-08"), new Date("2026-10-08T22:30:00Z"))).not.toBeNull();
  });

  it("parle d'une publication sans nom sans afficher de guillemets vides", () => {
    expect(schedulingRefusal(line("2026-10-07", "scheduled", "  "), now)).toMatch(
      /^Cette publication est antidatée/,
    );
  });
});

describe("bulkSchedulingRefusal", () => {
  it("rend le refus de la seule ligne fautive", () => {
    expect(bulkSchedulingRefusal([line("2026-10-14"), line("2026-10-07")], now)).toMatch(
      /^« MADDY RENTRÉE » est antidatée/,
    );
  });

  it("compte quand plusieurs coincent", () => {
    expect(bulkSchedulingRefusal([line("2026-10-07"), line(null)], now)).toBe(
      "2 publications sont antidatées ou sans date : change leur date ou publie-les maintenant.",
    );
  });

  it("ne dit rien quand tout part", () => {
    expect(bulkSchedulingRefusal([line("2026-10-08"), line("2026-10-09")], now)).toBeNull();
  });
});
