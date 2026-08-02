import { describe, expect, it } from "vitest";

import { analyseCadence, flaggedSubjectIds, weekOfMonth } from "./cadence";
import type { CadenceCode, CadenceIssue } from "./cadence";
import type { DeducedStrategy } from "./strategy";
import { makeMonth, makeSubject } from "./test-support";

const MONTH = "2026-08-01";

/**
 * Un mois sain : alternance des formats, aucune publication le week-end, pas de
 * trou, et une couverture du 3 au 31. Août 2026 démarre un samedi, toutes les
 * dates retenues ici tombent donc en semaine.
 */
const HEALTHY = makeMonth([
  { day: 3, format: "post" },
  { day: 6, format: "reel" },
  { day: 10, format: "post" },
  { day: 13, format: "story" },
  { day: 17, format: "post" },
  { day: 20, format: "reel" },
  { day: 24, format: "post" },
  { day: 27, format: "story" },
  { day: 31, format: "post" },
]);

const STRATEGY: DeducedStrategy = {
  source: "history",
  monthsObserved: ["2026-06-01", "2026-07-01"],
  platforms: [
    {
      platform: "meta",
      monthlyTarget: 9,
      monthsObserved: 2,
      formatMix: [
        { format: "post", perMonth: 5, share: 5 / 9 },
        { format: "reel", perMonth: 2, share: 2 / 9 },
        { format: "story", perMonth: 2, share: 2 / 9 },
      ],
      weekdayHistogram: [0, 0, 0, 0, 0, 0, 0],
      sponsoringMedian: null,
      templates: [],
    },
  ],
};

function codes(issues: CadenceIssue[]): CadenceCode[] {
  return issues.map((issue) => issue.code);
}

function only(issues: CadenceIssue[], code: CadenceCode): CadenceIssue[] {
  return issues.filter((issue) => issue.code === code);
}

describe("mois sain", () => {
  it("ne signale rien", () => {
    expect(analyseCadence({ month: MONTH, subjects: HEALTHY })).toEqual([]);
  });

  it("ne signale rien non plus face à une stratégie qu'il respecte", () => {
    // Neuf contenus, cinq posts, deux reels, deux stories : exactement la cible.
    expect(
      analyseCadence({ month: MONTH, subjects: HEALTHY, strategy: STRATEGY }),
    ).toEqual([]);
  });
});

describe("alternance des formats", () => {
  it("signale deux Reels à la suite", () => {
    const issues = analyseCadence({
      month: MONTH,
      subjects: makeMonth([
        { day: 3, format: "reel" },
        { day: 6, format: "reel" },
      ]),
    });

    const flagged = only(issues, "consecutive_format");
    expect(flagged).toHaveLength(1);
    expect(flagged[0]!.severity).toBe("warning");
    expect(flagged[0]!.subjectIds).toHaveLength(2);
  });

  it("signale deux sets de Stories à la suite", () => {
    const issues = analyseCadence({
      month: MONTH,
      subjects: makeMonth([
        { day: 3, format: "story" },
        { day: 6, format: "story" },
      ]),
    });
    expect(only(issues, "consecutive_format")).toHaveLength(1);
  });

  it("laisse les Posts s'enchaîner", () => {
    // Le Post est le format de fond : deux d'affilée n'a rien d'anormal.
    const issues = analyseCadence({
      month: MONTH,
      subjects: makeMonth([
        { day: 3, format: "post" },
        { day: 6, format: "post" },
      ]),
    });
    expect(codes(issues)).not.toContain("consecutive_format");
  });
});

describe("dates", () => {
  it("signale les publications du week-end sans en faire un blocage", () => {
    // 2026-08-02 est un dimanche.
    const issues = only(
      analyseCadence({ month: MONTH, subjects: makeMonth([{ day: 2 }]) }),
      "weekend",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe("info");
  });

  it("signale un trou de couverture", () => {
    const issues = only(
      analyseCadence({
        month: MONTH,
        subjects: makeMonth([{ day: 3 }, { day: 20 }]),
      }),
      "coverage_gap",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain("17 jours");
  });

  it("signale un mois qui démarre tard ou s'arrête tôt", () => {
    const issues = codes(
      analyseCadence({
        month: MONTH,
        subjects: makeMonth([{ day: 12 }, { day: 14 }]),
      }),
    );
    expect(issues.filter((code) => code === "month_edges")).toHaveLength(2);
  });

  it("signale les contenus sans date", () => {
    const issues = only(
      analyseCadence({
        month: MONTH,
        subjects: [
          ...makeMonth([{ day: 3 }]),
          makeSubject({ id: "undated", scheduled_on: null }),
        ],
      }),
      "undated",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe("warning");
    expect(issues[0]!.subjectIds).toEqual(["undated"]);
  });
});

describe("volume et mix, face à la stratégie", () => {
  it("signale un mois nettement sous la cible", () => {
    const issues = only(
      analyseCadence({
        month: MONTH,
        subjects: makeMonth([{ day: 3 }, { day: 10 }]),
        strategy: STRATEGY,
      }),
      "volume_off_target",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain("2 contenus contre 9");
  });

  it("ne dit rien du volume en l'absence de stratégie", () => {
    const issues = codes(
      analyseCadence({ month: MONTH, subjects: makeMonth([{ day: 3 }]) }),
    );
    expect(issues).not.toContain("volume_off_target");
    expect(issues).not.toContain("format_mix_off");
  });

  it("signale un mix qui s'écarte de l'habitude", () => {
    // Neuf posts là où la cible en attend cinq, plus aucun reel ni story.
    const issues = only(
      analyseCadence({
        month: MONTH,
        subjects: makeMonth(
          [3, 6, 10, 13, 17, 20, 24, 27, 31].map((day) => ({
            day,
            format: "post" as const,
          })),
        ),
        strategy: STRATEGY,
      }),
      "format_mix_off",
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]!.message).toContain("Posts");
  });
});

describe("rotation des templates", () => {
  it("signale un template replacé à la même semaine que le mois précédent", () => {
    const issues = only(
      analyseCadence({
        month: MONTH,
        subjects: [
          makeSubject({ id: "aout", scheduled_on: "2026-08-03", name: "GRID TALK" }),
        ],
        previousSubjects: [
          makeSubject({
            id: "juillet",
            scheduled_on: "2026-07-02",
            name: "GRID TALK",
          }),
        ],
      }),
      "template_repeat",
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]!.subjectIds).toEqual(["aout"]);
  });

  it("ne dit rien d'un template décalé dans le mois", () => {
    const issues = codes(
      analyseCadence({
        month: MONTH,
        subjects: [
          makeSubject({ id: "aout", scheduled_on: "2026-08-24", name: "GRID TALK" }),
        ],
        previousSubjects: [
          makeSubject({
            id: "juillet",
            scheduled_on: "2026-07-02",
            name: "GRID TALK",
          }),
        ],
      }),
    );
    expect(issues).not.toContain("template_repeat");
  });

  it("découpe le mois en semaines de sept jours", () => {
    expect(weekOfMonth("2026-08-01")).toBe(1);
    expect(weekOfMonth("2026-08-07")).toBe(1);
    expect(weekOfMonth("2026-08-08")).toBe(2);
    expect(weekOfMonth("2026-08-31")).toBe(5);
  });
});

describe("sujets à surligner", () => {
  it("retient les contenus fautifs", () => {
    const issues = analyseCadence({
      month: MONTH,
      subjects: makeMonth([
        { day: 3, format: "reel" },
        { day: 6, format: "reel" },
      ]),
    });
    expect(flaggedSubjectIds(issues).size).toBe(2);
  });

  it("écarte l'écart de volume, qui porte sur le mois entier", () => {
    // Surligner tous les contenus ferait clignoter la vue sans rien désigner.
    const issues = analyseCadence({
      month: MONTH,
      subjects: makeMonth([{ day: 3 }, { day: 10 }]),
      strategy: STRATEGY,
    });

    const volume = only(issues, "volume_off_target");
    expect(volume).toHaveLength(1);
    expect(volume[0]!.subjectIds).toHaveLength(2);
    expect(flaggedSubjectIds(volume).size).toBe(0);
  });
});

describe("contenus non retenus", () => {
  it("les écarte de toute analyse", () => {
    const issues = analyseCadence({
      month: MONTH,
      subjects: [
        ...HEALTHY,
        makeSubject({
          id: "abandonne",
          scheduled_on: "2026-08-04",
          format: "reel",
          status: "dropped",
        }),
      ],
    });
    // Le contenu abandonné aurait créé un doublon de format le 4 ; il n'existe
    // pas pour le lecteur, il ne doit pas exister pour l'analyse non plus.
    expect(issues).toEqual([]);
  });
});
