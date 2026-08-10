import { describe, expect, it } from "vitest";

import { countSubjects, filterMonths, matchesSubject } from "./search";
import type { MonthWithLanes, SubjectRow } from "./types";

const subject = (partial: Partial<SubjectRow>): SubjectRow =>
  ({
    id: partial.id ?? "s-1",
    name: partial.name ?? "",
    wording: partial.wording ?? null,
    ...partial,
  }) as SubjectRow;

const month = (lanes: { subjects: SubjectRow[] }[]): MonthWithLanes =>
  ({
    id: "m-1",
    label: "AOÛT",
    lanes: lanes.map((lane, index) => ({
      id: `l-${index}`,
      subjects: lane.subjects,
    })),
  }) as unknown as MonthWithLanes;

describe("matchesSubject", () => {
  it("trouve dans le sujet sans tenir compte des accents ni de la casse", () => {
    const row = subject({ name: "Recette d'été" });
    expect(matchesSubject(row, "ETE")).toBe(true);
    expect(matchesSubject(row, "recette")).toBe(true);
  });

  it("cherche aussi dans le wording", () => {
    const row = subject({ name: "SILMO", wording: "Rendez-vous porte de Versailles" });
    expect(matchesSubject(row, "versailles")).toBe(true);
    expect(matchesSubject(row, "lunettes")).toBe(false);
  });

  it("laisse tout passer quand le champ est vide", () => {
    expect(matchesSubject(subject({ name: "Peu importe" }), "  ")).toBe(true);
  });
});

describe("filterMonths", () => {
  const months = [
    month([
      { subjects: [subject({ id: "a", name: "Recette d'été" })] },
      { subjects: [subject({ id: "b", name: "SILMO", wording: "salon" })] },
    ]),
    month([{ subjects: [subject({ id: "c", name: "Concours" })] }]),
  ];

  it("ne garde que les publications qui répondent, et masque couloirs et mois vidés", () => {
    const filtered = filterMonths(months, "silmo");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.lanes).toHaveLength(1);
    expect(filtered[0]!.lanes[0]!.subjects.map((row) => row.id)).toEqual(["b"]);
  });

  it("rend tout tel quel sans recherche", () => {
    expect(filterMonths(months, "")).toBe(months);
  });

  it("compte les résultats à travers les mois", () => {
    expect(countSubjects(filterMonths(months, "co"))).toBe(1);
    expect(countSubjects(months)).toBe(3);
  });
});
