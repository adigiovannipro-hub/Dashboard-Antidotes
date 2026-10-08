import { describe, expect, it } from "vitest";

import { QUESTIONS, computeScoring, validateAnswers, type Answers } from "./questionnaire";

const full: Answers = {
  goal: "ventes",
  frequency: "plusieurs",
  management: "freelance",
  reporting: "natif",
  budget: "3k_8k",
  timing: "maintenant",
};

describe("QUESTIONS", () => {
  it("en compte six, pas une de plus", () => {
    expect(QUESTIONS).toHaveLength(6);
    expect(QUESTIONS.every((q) => q.kind === "single")).toBe(true);
  });
});

describe("validateAnswers", () => {
  it("accepte un jeu complet", () => {
    expect(validateAnswers(full)).toEqual({ ok: true });
  });

  it("nomme les questions manquantes ou hors liste", () => {
    const result = validateAnswers({ ...full, budget: "milliard", timing: undefined });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.missing).toEqual(["budget", "timing"]);
  });

  it("refuse une liste là où une seule réponse est attendue", () => {
    const result = validateAnswers({ ...full, goal: ["ventes"] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.missing).toEqual(["goal"]);
  });

  it("couvre toutes les questions déclarées", () => {
    const result = validateAnswers({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.missing).toHaveLength(QUESTIONS.length);
  });
});

describe("computeScoring", () => {
  it("rend une note entre 1 et 10 et une température", () => {
    const scoring = computeScoring(full);
    expect(scoring.score).toBeGreaterThanOrEqual(1);
    expect(scoring.score).toBeLessThanOrEqual(10);
    // 0,5 (objectif) + 2 (3 à 5 fois par semaine) + 2,5 (freelance) + 1 (stats natives) + 1,5 (3 à 8 k€)
    expect(scoring.score).toBe(7.5);
    expect(scoring.temperature).toBe("chaud");
  });

  it("plafonne à 10 une présence parfaite", () => {
    const scoring = computeScoring({ ...full, frequency: "quotidien", management: "agence", reporting: "tableau", budget: "plus_8k" });
    expect(scoring.score).toBe(10);
  });

  it("ne descend jamais sous 1, même sans présence", () => {
    const scoring = computeScoring({ ...full, frequency: "rarement", management: "personne", reporting: "aucun", budget: "indefini", goal: "structurer" });
    expect(scoring.score).toBe(1);
  });

  it("ne distingue pas une agence d'un freelance : les agences sont aussi des clientes", () => {
    const agence = computeScoring({ ...full, management: "agence" });
    const freelance = computeScoring({ ...full, management: "freelance" });
    expect(agence.score).toBe(freelance.score);
    expect(agence.temperature).toBe(freelance.temperature);
  });

  it("qualifie froid un curieux sans budget, tiède un projet à l'étude, chaud un budget posé qui veut agir", () => {
    expect(computeScoring({ ...full, budget: "moins_1k", timing: "curiosite", management: "personne" }).temperature).toBe("froid");
    expect(computeScoring({ ...full, budget: "1k_3k", timing: "trimestre", management: "moi" }).temperature).toBe("tiede");
    expect(computeScoring({ ...full, budget: "moins_1k", timing: "maintenant", management: "moi" }).temperature).toBe("tiede");
    expect(computeScoring({ ...full, budget: "3k_8k", timing: "maintenant", management: "personne" }).temperature).toBe("chaud");
  });

  it("explique la note question par question", () => {
    const scoring = computeScoring(full);
    expect(scoring.breakdown.frequency).toBe(2);
    expect(scoring.breakdown.reporting).toBe(1);
    expect(scoring.breakdown.timing).toBeUndefined();
  });
});
