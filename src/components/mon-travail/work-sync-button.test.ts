import { describe, expect, it } from "vitest";

import { resume } from "./work-sync-button";

/**
 * Ce que le bouton dit d'un passage.
 *
 * Le cas qui compte est le troisième : sans clé d'API, l'étape Fathom ne
 * s'exécute pas. Rendre « 0 tâche » ferait passer une configuration absente
 * pour une réunion sans action — la confusion exacte qui a fait chercher un
 * défaut ailleurs pendant une soirée.
 */
describe("resume", () => {
  it("annonce les tâches créées", () => {
    const out = resume({ report: { "fathom:o": { creees: 3, reunions: 2 } } });
    expect(out).toEqual({ ok: true, message: "3 tâches ajoutées." });
  });

  it("accorde au singulier", () => {
    const out = resume({ report: { "fathom:o": { creees: 1 } } });
    expect(out.message).toBe("1 tâche ajoutée.");
  });

  it("distingue « rien de nouveau » d'une étape non exécutée", () => {
    const relu = resume({ report: { "fathom:o": { creees: 0, reunions: 2 } } });
    expect(relu).toEqual({
      ok: true,
      message: "2 réunions relues — rien de nouveau à ajouter.",
    });

    const sansCle = resume({
      report: { "fathom:o": { raison: "FATHOM_API_KEY absente — étape ignorée." } },
    });
    expect(sansCle.ok).toBe(false);
    expect(sansCle.message).toContain("FATHOM_API_KEY");
  });

  it("additionne les organisations", () => {
    const out = resume({
      report: { "org:a": { creees: 2 }, "fathom:a": { creees: 3, reunions: 1 } },
    });
    expect(out.message).toBe("5 tâches ajoutées.");
  });

  it("fait passer une erreur avant tout le reste", () => {
    const out = resume({
      errors: ["Fathom, organisation a : 401"],
      report: { "fathom:a": { creees: 4 } },
    });
    expect(out).toEqual({ ok: false, message: "Fathom, organisation a : 401" });
  });

  it("sait ne rien avoir à dire", () => {
    expect(resume({})).toEqual({
      ok: true,
      message: "Rien de nouveau : tout était déjà là.",
    });
  });
});
