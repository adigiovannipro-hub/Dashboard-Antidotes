import { describe, expect, it } from "vitest";

import { buildContextDiff, mergeProposal } from "./diff";
import type { ClientContext, ContextProposal } from "./types";

const makeContext = (overrides: Partial<ClientContext> = {}): ClientContext => ({
  id: "ctx-1",
  workspace_id: "ws-1",
  version: 1,
  is_active: true,
  main_context: "Contexte initial.",
  audience: null,
  tone_of_voice: "Sobre.",
  pillars: [],
  restrictions: "Pas d'emoji.",
  platforms: {},
  deliverables: { intentions: "", reseaux: [], publications: [] },
  validated_examples: [],
  client_feedback: null,
  sourced_facts: [],
  created_at: "2026-08-01T00:00:00Z",
  created_by: null,
  ...overrides,
});

const makeProposal = (overrides: Partial<ContextProposal> = {}): ContextProposal => ({
  main_context: "Contexte initial.",
  audience: "Femmes 25-45 ans.",
  tone_of_voice: "Sobre.",
  pillars: [],
  restrictions: "Pas d'emoji.",
  platforms: {},
  ...overrides,
});

describe("buildContextDiff", () => {
  it("marque changés les seuls champs qui diffèrent", () => {
    const diff = buildContextDiff(makeContext(), makeProposal());
    const byKey = Object.fromEntries(diff.map((entry) => [entry.key, entry]));

    expect(byKey.main_context!.changed).toBe(false);
    expect(byKey.tone_of_voice!.changed).toBe(false);
    expect(byKey.audience!.changed).toBe(true);
    expect(byKey.audience!.before).toBe("");
    expect(byKey.audience!.after).toBe("Femmes 25-45 ans.");
  });

  it("compare depuis un brief inexistant : tout champ proposé non vide est un changement", () => {
    const diff = buildContextDiff(null, makeProposal());
    const changedKeys = diff.filter((entry) => entry.changed).map((entry) => entry.key);

    expect(changedKeys).toContain("main_context");
    // Un champ proposé vide n'est pas un changement, même sur un brief absent.
    expect(changedKeys).not.toContain("platforms");
  });

  it("rend les piliers lisibles dans les deux colonnes", () => {
    const diff = buildContextDiff(
      makeContext(),
      makeProposal({
        pillars: [
          {
            nom: "Atelier",
            description: "Coulisses.",
            formats: ["Reels"],
            angles: ["portrait"],
            frequence: "2 par mois",
            objectif_business: "prises de rendez-vous",
            cta_autorises: ["Prendre rendez-vous"],
          },
        ],
      }),
    );
    const pillars = diff.find((entry) => entry.key === "pillars")!;

    expect(pillars.changed).toBe(true);
    expect(pillars.after).toContain("Atelier");
    expect(pillars.after).toContain("Objectif business : prises de rendez-vous");
    expect(pillars.after).toContain("CTA autorisés : Prendre rendez-vous");
    expect(pillars.after).toContain("Formats : Reels");
    expect(pillars.after).toContain("Fréquence : 2 par mois");
  });
});

describe("mergeProposal", () => {
  it("applique la proposition sur les seuls champs acceptés", () => {
    const merged = mergeProposal(makeContext(), makeProposal(), ["audience"]);

    expect(merged.audience).toBe("Femmes 25-45 ans.");
    // Refusé : la valeur actuelle reste, celle proposée est perdue.
    expect(merged.tone_of_voice).toBe("Sobre.");
    expect(merged.main_context).toBe("Contexte initial.");
  });

  it("n'écrase jamais un champ refusé, même vide dans la proposition", () => {
    const merged = mergeProposal(
      makeContext({ restrictions: "Interdit manuel précieux." }),
      makeProposal({ restrictions: "" }),
      [],
    );

    expect(merged.restrictions).toBe("Interdit manuel précieux.");
  });

  it("part d'un brief vide quand aucun n'existe", () => {
    const merged = mergeProposal(null, makeProposal(), ["audience"]);

    expect(merged.audience).toBe("Femmes 25-45 ans.");
    expect(merged.main_context).toBe("");
    expect(merged.pillars).toEqual([]);
  });
});
