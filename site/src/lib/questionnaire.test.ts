import { describe, expect, it } from "vitest";

import { QUESTIONS, computeScoring, validateAnswers, type Answers } from "./questionnaire";

const full: Answers = {
  role: "dirigeant",
  sector: "commerce",
  revenue: "50k_200k",
  budget: "3k_8k",
  networks: ["instagram", "tiktok", "linkedin"],
  frequency: "plusieurs",
  management: "freelance",
  goal: "ventes",
  blocker: "resultats",
  ads: "500_2000",
  reporting: "natif",
  ai: "parfois",
  timing: "maintenant",
};

describe("validateAnswers", () => {
  it("accepte un jeu complet", () => {
    expect(validateAnswers(full)).toEqual({ ok: true });
  });

  it("nomme les questions manquantes ou hors liste", () => {
    const result = validateAnswers({ ...full, budget: "milliard", networks: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.missing).toEqual(["budget", "networks"]);
  });

  it("couvre toutes les questions déclarées", () => {
    const result = validateAnswers({});
    if (!result.ok) expect(result.missing).toHaveLength(QUESTIONS.length);
  });
});

describe("computeScoring", () => {
  it("rend une note entre 1 et 10 et une température", () => {
    const scoring = computeScoring(full);
    expect(scoring.score).toBeGreaterThanOrEqual(1);
    expect(scoring.score).toBeLessThanOrEqual(10);
    expect(scoring.score).toBe(7.5);
    expect(scoring.temperature).toBe("chaud");
  });

  it("plafonne à 10 une présence parfaite", () => {
    const scoring = computeScoring({
      ...full,
      frequency: "quotidien",
      management: "agence",
      reporting: "tableau",
      ads: "plus_2000",
      ai: "oui",
      budget: "plus_8k",
      networks: ["instagram", "facebook", "tiktok", "linkedin"],
    });
    expect(scoring.score).toBe(10);
  });

  it("ne descend jamais sous 1, même sans présence", () => {
    const scoring = computeScoring({
      ...full,
      frequency: "rarement",
      management: "personne",
      reporting: "aucun",
      ads: "non",
      ai: "non",
      budget: "indefini",
      networks: ["aucun"],
      goal: "structurer",
    });
    expect(scoring.score).toBe(1);
  });

  it("qualifie froid un curieux sans budget, tiède un projet à l'étude", () => {
    expect(computeScoring({ ...full, budget: "moins_1k", revenue: "moins_10k", timing: "curiosite", role: "freelance", ads: "non" }).temperature).toBe("froid");
    expect(computeScoring({ ...full, budget: "1k_3k", revenue: "10k_50k", timing: "trimestre", ads: "non" }).temperature).toBe("tiede");
  });

  it("explique la note question par question", () => {
    const scoring = computeScoring(full);
    expect(scoring.breakdown.networks).toBe(1.5);
    expect(scoring.breakdown.frequency).toBe(1.5);
  });
});
