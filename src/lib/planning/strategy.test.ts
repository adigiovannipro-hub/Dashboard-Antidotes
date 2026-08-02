import { describe, expect, it } from "vitest";

import {
  deduceStrategy,
  median,
  platformStrategy,
  resolveStrategy,
  templateKey,
} from "./strategy";
import { makeSubject } from "./test-support";
import type { ProducibleSubject } from "./types";

const AS_OF = new Date("2026-08-02T00:00:00Z");

/** `count` sujets d'un format donné, répartis sur un mois. */
function batch(
  month: string,
  format: ProducibleSubject["format"],
  count: number,
  extra: Partial<ProducibleSubject> = {},
): ProducibleSubject[] {
  return Array.from({ length: count }, (_, index) =>
    makeSubject({
      id: `${month}-${format}-${index}`,
      scheduled_on: `${month}-${String(index + 1).padStart(2, "0")}`,
      format,
      ...extra,
    }),
  );
}

/**
 * Trois mois volontairement déséquilibrés : juillet est un mois de lancement à
 * douze contenus, mai et juin sont le rythme réel.
 */
const HISTORY: ProducibleSubject[] = [
  ...batch("2026-05", "post", 3),
  ...batch("2026-05", "reel", 1),
  ...batch("2026-06", "post", 4),
  ...batch("2026-06", "reel", 2),
  ...batch("2026-07", "post", 8),
  ...batch("2026-07", "reel", 4),
];

describe("médiane", () => {
  it("prend la valeur centrale d'une série impaire", () => {
    expect(median([4, 6, 12])).toBe(6);
  });

  it("moyenne les deux valeurs centrales d'une série paire", () => {
    expect(median([2, 4, 6, 8])).toBe(5);
  });

  it("rend null sur une série vide", () => {
    expect(median([])).toBeNull();
  });
});

describe("clé de template", () => {
  it("regroupe les déclinaisons numérotées d'un même template", () => {
    expect(templateKey("CAMPAGNE - CAPSULE 1")).toBe("CAMPAGNE - CAPSULE");
    expect(templateKey("CAMPAGNE - CAPSULE 2")).toBe("CAMPAGNE - CAPSULE");
    expect(templateKey("MOMENTS BONDET 1")).toBe("MOMENTS BONDET");
  });

  it("laisse intact un nom sans numéro", () => {
    expect(templateKey("Savoir-faire atelier")).toBe("SAVOIR-FAIRE ATELIER");
  });
});

describe("déduction depuis l'historique", () => {
  it("prend la médiane et non la moyenne du volume mensuel", () => {
    // Volumes observés : 4, 6, 12. La moyenne dirait 7 et laisserait croire
    // que le mois de lancement est la norme ; la médiane dit 6.
    const strategy = deduceStrategy(HISTORY, { asOf: AS_OF });
    expect(platformStrategy(strategy, "meta")?.monthlyTarget).toBe(6);
  });

  it("écarte le mois en cours, encore en cours de remplissage", () => {
    const withCurrentMonth = [...HISTORY, ...batch("2026-08", "post", 2)];
    const strategy = deduceStrategy(withCurrentMonth, { asOf: AS_OF });

    expect(strategy.monthsObserved).toEqual([
      "2026-05-01",
      "2026-06-01",
      "2026-07-01",
    ]);
    expect(platformStrategy(strategy, "meta")?.monthlyTarget).toBe(6);
  });

  it("écarte aussi les mois à venir", () => {
    const withFuture = [...HISTORY, ...batch("2026-09", "post", 30)];
    const strategy = deduceStrategy(withFuture, { asOf: AS_OF });
    expect(strategy.monthsObserved).not.toContain("2026-09-01");
    expect(platformStrategy(strategy, "meta")?.monthlyTarget).toBe(6);
  });

  it("ne compte pas les contenus non retenus", () => {
    const dropped = Array.from({ length: 5 }, (_, index) =>
      makeSubject({
        id: `dropped-${index}`,
        scheduled_on: `2026-06-2${index}`,
        status: "dropped",
      }),
    );
    const strategy = deduceStrategy([...HISTORY, ...dropped], { asOf: AS_OF });
    // Juin reste à 6, donc la médiane ne bouge pas.
    expect(platformStrategy(strategy, "meta")?.monthlyTarget).toBe(6);
  });

  it("respecte la profondeur d'analyse demandée", () => {
    const strategy = deduceStrategy(HISTORY, { asOf: AS_OF, lookbackMonths: 2 });
    expect(strategy.monthsObserved).toEqual(["2026-06-01", "2026-07-01"]);
    // Volumes 6 et 12 : la médiane devient 9.
    expect(platformStrategy(strategy, "meta")?.monthlyTarget).toBe(9);
  });

  it("déduit la répartition des formats", () => {
    const meta = platformStrategy(deduceStrategy(HISTORY, { asOf: AS_OF }), "meta");
    const post = meta?.formatMix.find((entry) => entry.format === "post");
    const reel = meta?.formatMix.find((entry) => entry.format === "reel");

    // Posts : 3, 4, 8 → 4. Reels : 1, 2, 4 → 2.
    expect(post?.perMonth).toBe(4);
    expect(reel?.perMonth).toBe(2);
    expect(post?.share).toBeCloseTo(2 / 3, 5);
    expect(reel?.share).toBeCloseTo(1 / 3, 5);
  });

  it("compte les jours de publication", () => {
    // 2026-08-02 est un dimanche, 2026-08-03 un lundi.
    const strategy = deduceStrategy(
      [
        makeSubject({ id: "a", scheduled_on: "2026-07-05" }), // dimanche
        makeSubject({ id: "b", scheduled_on: "2026-07-06" }), // lundi
        makeSubject({ id: "c", scheduled_on: "2026-07-13" }), // lundi
      ],
      { asOf: AS_OF },
    );

    const histogram = platformStrategy(strategy, "meta")?.weekdayHistogram;
    expect(histogram?.[0]).toBe(1);
    expect(histogram?.[1]).toBe(2);
  });

  it("déduit le budget de sponsorisation habituel", () => {
    const strategy = deduceStrategy(
      [
        makeSubject({ id: "a", scheduled_on: "2026-07-06", sponsoring: 100 }),
        makeSubject({ id: "b", scheduled_on: "2026-07-13", sponsoring: 200 }),
        makeSubject({ id: "c", scheduled_on: "2026-07-20", sponsoring: 300 }),
        // Sans budget : ne doit pas être compté comme un budget de zéro.
        makeSubject({ id: "d", scheduled_on: "2026-07-27", sponsoring: null }),
      ],
      { asOf: AS_OF },
    );
    expect(platformStrategy(strategy, "meta")?.sponsoringMedian).toBe(200);
  });

  it("relève les templates récurrents", () => {
    const strategy = deduceStrategy(
      [
        makeSubject({ id: "a", scheduled_on: "2026-06-02", name: "GRID TALK" }),
        makeSubject({ id: "b", scheduled_on: "2026-07-02", name: "GRID TALK" }),
        makeSubject({ id: "c", scheduled_on: "2026-07-09", name: "AGENDA DU MOIS" }),
      ],
      { asOf: AS_OF },
    );

    const templates = platformStrategy(strategy, "meta")?.templates ?? [];
    expect(templates[0]).toEqual({
      template: "GRID TALK",
      uses: 2,
      lastUsedMonth: "2026-07-01",
    });
  });

  it("sépare les plateformes", () => {
    const linkedin = ["2026-06-09", "2026-06-23", "2026-07-07", "2026-07-21"].map(
      (date) =>
        makeSubject({ id: `li-${date}`, scheduled_on: date, platform: "linkedin" }),
    );

    const strategy = deduceStrategy(
      [...batch("2026-06", "post", 4), ...batch("2026-07", "post", 4), ...linkedin],
      { asOf: AS_OF },
    );

    expect(platformStrategy(strategy, "meta")?.monthlyTarget).toBe(4);
    expect(platformStrategy(strategy, "linkedin")?.monthlyTarget).toBe(2);
  });

  it("annonce l'absence d'historique plutôt que d'inventer une cible", () => {
    const strategy = deduceStrategy([], { asOf: AS_OF });
    expect(strategy.source).toBe("none");
    expect(strategy.platforms).toEqual([]);
  });

  it("ne retient que des mois complets, même si tout est récent", () => {
    // Uniquement le mois en cours : rien d'exploitable.
    const strategy = deduceStrategy(batch("2026-08", "post", 5), { asOf: AS_OF });
    expect(strategy.source).toBe("none");
  });
});

describe("stratégie déclarée", () => {
  it("prime sur l'historique", () => {
    const strategy = resolveStrategy(
      {
        platforms: {
          meta: { monthly_target: 10, format_mix: { post: 6, reel: 4 } },
        },
      },
      HISTORY,
      { asOf: AS_OF },
    );

    expect(strategy.source).toBe("declared");
    const meta = platformStrategy(strategy, "meta");
    expect(meta?.monthlyTarget).toBe(10);
    expect(meta?.formatMix.find((entry) => entry.format === "post")?.share).toBeCloseTo(
      0.6,
      5,
    );
  });

  it("retombe sur la déduction quand elle est absente", () => {
    const strategy = resolveStrategy(null, HISTORY, { asOf: AS_OF });
    expect(strategy.source).toBe("history");
  });
});
