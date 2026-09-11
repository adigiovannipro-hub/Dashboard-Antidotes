import { describe, expect, it } from "vitest";

import { computeCompleteness, missingEntries } from "./completeness";
import type { ClientContext } from "./types";

const makeContext = (overrides: Partial<ClientContext> = {}): ClientContext => ({
  id: "ctx-1",
  workspace_id: "ws-1",
  version: 1,
  is_active: true,
  main_context: null,
  audience: null,
  tone_of_voice: null,
  pillars: [],
  restrictions: null,
  platforms: {},
  deliverables: { intentions: "", reseaux: [], publications: [] },
  validated_examples: [],
  client_feedback: null,
  sourced_facts: [],
  created_at: "2026-08-01T00:00:00Z",
  created_by: null,
  ...overrides,
});

describe("computeCompleteness", () => {
  it("rend 0 % sans aucun brief", () => {
    const result = computeCompleteness({ brief: null, settings: null });
    expect(result.remplis).toBe(0);
    expect(result.pourcentage).toBe(0);
    expect(result.total).toBe(result.entries.length);
  });

  it("ne compte pas un champ qui ne porte que des espaces", () => {
    const result = computeCompleteness({
      brief: makeContext({ main_context: "   " }),
      settings: null,
    });
    expect(result.remplis).toBe(0);
  });

  it("ne compte pas une règle de plateforme vide posée par une clé orpheline", () => {
    const result = computeCompleteness({
      brief: makeContext({ platforms: { instagram: "  " } }),
      settings: null,
    });
    expect(missingEntries(result).map((entry) => entry.ancre)).toContain("plateformes");
  });

  it("compte un réseau déclaré seulement s'il porte des quantités", () => {
    const sansQuantite = computeCompleteness({
      brief: makeContext({
        deliverables: {
          intentions: "",
          reseaux: [{ nom: "Instagram", publications: [] }],
          publications: [],
        },
      }),
      settings: null,
    });
    expect(missingEntries(sansQuantite).map((entry) => entry.ancre)).toContain("livrables");

    const avecQuantite = computeCompleteness({
      brief: makeContext({
        deliverables: {
          intentions: "",
          reseaux: [
            { nom: "Instagram", publications: [{ categorie: "Reels", quantite: 4 }] },
          ],
          publications: [],
        },
      }),
      settings: null,
    });
    expect(missingEntries(avecQuantite).map((entry) => entry.ancre)).not.toContain(
      "livrables",
    );
  });

  it("atteint 100 % quand les dix blocs sont remplis", () => {
    const result = computeCompleteness({
      brief: makeContext({
        main_context: "Marque.",
        audience: "Cibles.",
        tone_of_voice: "Ton.",
        restrictions: "Interdits.",
        platforms: { instagram: "Tutoiement." },
        pillars: [
          { nom: "Atelier", description: "…", formats: [], angles: [], frequence: "" },
        ],
        deliverables: {
          intentions: "",
          reseaux: [
            { nom: "Instagram", publications: [{ categorie: "Reels", quantite: 4 }] },
          ],
          publications: [],
        },
        validated_examples: [{ reseau: "instagram", texte: "Un post." }],
        client_feedback: "Ne pas dire « iconique ».",
        sourced_facts: [{ fait: "Fondé en 1974.", source: "", verifie_le: "2026-09-01" }],
      }),
      settings: null,
    });

    expect(result.pourcentage).toBe(100);
    expect(missingEntries(result)).toEqual([]);
  });

  it("donne une ancre unique à chaque bloc", () => {
    const { entries } = computeCompleteness({ brief: null, settings: null });
    expect(new Set(entries.map((entry) => entry.ancre)).size).toBe(entries.length);
  });
});

describe("missingEntries", () => {
  it("ne garde que les blocs vides, dans l'ordre de la page", () => {
    const result = computeCompleteness({
      brief: makeContext({ main_context: "Marque.", audience: "Cibles." }),
      settings: null,
    });
    const ancres = missingEntries(result).map((entry) => entry.ancre);
    expect(ancres).not.toContain("marque");
    expect(ancres).not.toContain("cibles");
    expect(ancres[0]).toBe("livrables");
  });
});
