import { describe, expect, it } from "vitest";

import { assessMonth } from "./health";
import type { GapCode } from "./health";
import { makeSubject } from "./test-support";
import type { SubjectWithLane } from "./types";

const AS_OF = new Date("2026-08-10T09:00:00Z");

function gapCodes(subjects: SubjectWithLane[]): GapCode[] {
  return assessMonth(subjects, { asOf: AS_OF }).gaps.map((gap) => gap.code);
}

/** Un mois entièrement publié : rien ne reste à faire. */
const SHIPPED = [
  makeSubject({ id: "a", scheduled_on: "2026-08-03", status: "published" }),
  makeSubject({ id: "b", scheduled_on: "2026-08-06", status: "published" }),
];

describe("mois terminé", () => {
  it("ne relève aucun manque", () => {
    const health = assessMonth(SHIPPED, { asOf: AS_OF });
    expect(health.gaps).toEqual([]);
    expect(health.total).toBe(2);
    expect(health.published).toBe(2);
    expect(health.completion).toBe(1);
    expect(health.nextUp).toBeNull();
  });
});

describe("contenus en retard", () => {
  it("signale une date passée sans publication", () => {
    const health = assessMonth(
      [makeSubject({ id: "a", scheduled_on: "2026-08-05", status: "validated" })],
      { asOf: AS_OF },
    );

    const overdue = health.gaps.find((gap) => gap.code === "overdue");
    expect(overdue?.severity).toBe("critical");
    expect(overdue?.subjectIds).toEqual(["a"]);
  });

  it("ne dit rien d'un contenu passé et publié", () => {
    expect(
      gapCodes([
        makeSubject({ id: "a", scheduled_on: "2026-08-05", status: "published" }),
      ]),
    ).not.toContain("overdue");
  });
});

describe("validation à l'approche de la date", () => {
  it("alerte sur un contenu qui sort dans deux jours sans être validé", () => {
    const health = assessMonth(
      [makeSubject({ id: "a", scheduled_on: "2026-08-12", status: "in_progress" })],
      { asOf: AS_OF },
    );

    const gap = health.gaps.find((entry) => entry.code === "not_validated");
    expect(gap?.severity).toBe("critical");
    expect(gap?.subjectIds).toEqual(["a"]);
  });

  it("laisse tranquille un contenu lointain encore en cours", () => {
    expect(
      gapCodes([
        makeSubject({ id: "a", scheduled_on: "2026-08-28", status: "in_progress" }),
      ]),
    ).not.toContain("not_validated");
  });

  it("accepte « programmé » comme prêt à partir", () => {
    expect(
      gapCodes([
        makeSubject({ id: "a", scheduled_on: "2026-08-12", status: "scheduled" }),
      ]),
    ).not.toContain("not_validated");
  });
});

describe("wording et visuel", () => {
  it("relève un wording vide", () => {
    const health = assessMonth(
      [makeSubject({ id: "a", scheduled_on: "2026-08-28", wording: null })],
      { asOf: AS_OF },
    );
    const gap = health.gaps.find((entry) => entry.code === "wording_missing");
    expect(gap?.subjectIds).toEqual(["a"]);
    // Lointain : c'est un avertissement, pas une alerte.
    expect(gap?.severity).toBe("warning");
  });

  it("hausse la sévérité quand la date approche", () => {
    const health = assessMonth(
      [makeSubject({ id: "a", scheduled_on: "2026-08-11", wording: "  " })],
      { asOf: AS_OF },
    );
    expect(
      health.gaps.find((entry) => entry.code === "wording_missing")?.severity,
    ).toBe("critical");
  });

  it("compte un wording en attente de push comme écrit", () => {
    // Il existe, il est juste encore chez nous plutôt que dans Monday.
    expect(
      gapCodes([
        makeSubject({
          id: "a",
          scheduled_on: "2026-08-28",
          wording: null,
          pending_wording: "Une caption prête.",
        }),
      ]),
    ).not.toContain("wording_missing");
  });

  it("relève un visuel manquant", () => {
    const health = assessMonth(
      [makeSubject({ id: "a", scheduled_on: "2026-08-28", visual_urls: [] })],
      { asOf: AS_OF },
    );
    expect(
      health.gaps.find((entry) => entry.code === "visual_missing")?.subjectIds,
    ).toEqual(["a"]);
  });
});

describe("file d'attente du push", () => {
  it("compte les wordings pas encore renvoyés dans Monday", () => {
    const health = assessMonth(
      [
        makeSubject({
          id: "a",
          scheduled_on: "2026-08-28",
          pending_wording: "Nouvelle version.",
          pending_since: "2026-08-09T10:00:00.000Z",
        }),
      ],
      { asOf: AS_OF },
    );

    expect(health.pendingPush).toBe(1);
    const gap = health.gaps.find((entry) => entry.code === "pending_push");
    expect(gap?.severity).toBe("info");
  });
});

describe("avancement", () => {
  it("compte les contenus prêts comme les contenus publiés", () => {
    const health = assessMonth(
      [
        makeSubject({ id: "a", scheduled_on: "2026-08-03", status: "published" }),
        makeSubject({ id: "b", scheduled_on: "2026-08-20", status: "validated" }),
        makeSubject({ id: "c", scheduled_on: "2026-08-24", status: "in_progress" }),
        makeSubject({ id: "d", scheduled_on: "2026-08-28", status: "idea" }),
      ],
      { asOf: AS_OF },
    );

    expect(health.total).toBe(4);
    expect(health.published).toBe(1);
    expect(health.ready).toBe(1);
    expect(health.completion).toBe(0.5);
  });

  it("écarte les contenus non retenus du décompte", () => {
    const health = assessMonth(
      [
        makeSubject({ id: "a", scheduled_on: "2026-08-03", status: "published" }),
        makeSubject({
          id: "b",
          scheduled_on: "2026-08-20",
          status: "dropped",
          wording: null,
          visual_urls: [],
        }),
      ],
      { asOf: AS_OF },
    );

    expect(health.total).toBe(1);
    expect(health.completion).toBe(1);
    // Ni son wording ni son visuel manquants ne doivent remonter.
    expect(health.gaps).toEqual([]);
  });

  it("ne divise pas par zéro sur un mois vide", () => {
    const health = assessMonth([], { asOf: AS_OF });
    expect(health.total).toBe(0);
    expect(health.completion).toBe(0);
    expect(health.gaps).toEqual([]);
  });
});

describe("prochain contenu", () => {
  it("désigne le plus proche encore à sortir", () => {
    const health = assessMonth(
      [
        makeSubject({ id: "passe", scheduled_on: "2026-08-03", status: "published" }),
        makeSubject({ id: "proche", scheduled_on: "2026-08-13" }),
        makeSubject({ id: "loin", scheduled_on: "2026-08-27" }),
      ],
      { asOf: AS_OF },
    );
    expect(health.nextUp?.id).toBe("proche");
  });

  it("inclut un contenu daté d'aujourd'hui", () => {
    const health = assessMonth(
      [makeSubject({ id: "aujourdhui", scheduled_on: "2026-08-10" })],
      { asOf: AS_OF },
    );
    expect(health.nextUp?.id).toBe("aujourdhui");
  });
});
