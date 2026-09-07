import { describe, expect, it } from "vitest";

import { DEFAULT_JOB_KEYWORDS } from "./config";
import {
  matchJobKeyword,
  pickDecisionMaker,
  seniorityOf,
  type PersonCandidate,
} from "./decision-maker";

const person = (overrides: Partial<PersonCandidate>): PersonCandidate => ({
  first_name: "Camille",
  last_name: "Roux",
  role: "Gérante",
  source: "legal_registry",
  ...overrides,
});

const options = (employees: number | null, jobKeywords = DEFAULT_JOB_KEYWORDS) => ({
  jobKeywords,
  marketingThreshold: 20,
  employees,
});

describe("seniorityOf", () => {
  it("lit le niveau sans accents ni casse", () => {
    expect(seniorityOf("Gerant")).toBe("founder");
    expect(seniorityOf("Présidente")).toBe("founder");
    expect(seniorityOf("Directrice marketing")).toBe("head_of");
    expect(seniorityOf("Responsable e-commerce")).toBe("manager");
    expect(seniorityOf("Comptable")).toBe("other");
    expect(seniorityOf(null)).toBe("other");
  });
});

describe("matchJobKeyword", () => {
  it("rend le mot-clé de la campagne contenu dans le poste", () => {
    expect(matchJobKeyword("Responsable Marketing & Communication", DEFAULT_JOB_KEYWORDS)).toBe(
      "responsable marketing",
    );
    expect(matchJobKeyword("Comptable", DEFAULT_JOB_KEYWORDS)).toBeNull();
  });
});

describe("pickDecisionMaker", () => {
  it("écarte un poste hors cible : sans nom reconnu, pas de contact", () => {
    expect(
      pickDecisionMaker([person({ role: "Comptable" }), person({ role: null })], options(5)),
    ).toBeNull();
  });

  it("préfère le dirigeant dans une petite structure", () => {
    const picked = pickDecisionMaker(
      [
        person({ first_name: "Nora", last_name: "Diallo", role: "Responsable marketing" }),
        person({ role: "Gérante" }),
      ],
      options(8),
    );
    expect(picked?.person.first_name).toBe("Camille");
    expect(picked?.seniority).toBe("founder");
    expect(picked?.matched_keyword).toBe("gérant");
  });

  it("préfère le marketing au-delà du seuil d'effectif", () => {
    const picked = pickDecisionMaker(
      [
        person({ role: "Présidente" }),
        person({ first_name: "Nora", last_name: "Diallo", role: "Responsable marketing" }),
      ],
      options(45),
    );
    expect(picked?.person.first_name).toBe("Nora");
    expect(picked?.seniority).toBe("manager");
  });

  it("revient au dirigeant si personne du marketing ne correspond", () => {
    const picked = pickDecisionMaker([person({ role: "CEO" })], options(200));
    expect(picked?.person.last_name).toBe("Roux");
  });

  it("sans effectif connu, vise le dirigeant", () => {
    const picked = pickDecisionMaker(
      [
        person({ first_name: "Nora", last_name: "Diallo", role: "Directrice marketing" }),
        person({ role: "Fondateur" }),
      ],
      options(null),
    );
    expect(picked?.person.first_name).toBe("Camille");
  });

  it("à famille égale, prend le plus senior puis le nom complet", () => {
    const picked = pickDecisionMaker(
      [
        person({ first_name: "Léa", last_name: null, role: "Directrice marketing" }),
        person({ first_name: "Marc", last_name: "Petit", role: "Responsable marketing" }),
        person({ first_name: "Anne", last_name: "Lam", role: "Directrice marketing" }),
      ],
      options(60),
    );
    expect(picked?.person.first_name).toBe("Anne");
  });

  it("suit les mots-clés de la campagne, pas les défauts", () => {
    const picked = pickDecisionMaker(
      [person({ role: "Gérante" }), person({ first_name: "Paul", last_name: "Roy", role: "Head of Sales" })],
      options(5, ["head of sales"]),
    );
    expect(picked?.person.first_name).toBe("Paul");
  });
});
