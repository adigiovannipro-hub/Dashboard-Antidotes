import { describe, expect, it } from "vitest";

import { buildContextDiff, mergeProposal } from "./diff";
import type { ClientContext, ContextProposal } from "./types";

const makeContext = (overrides: Partial<ClientContext> = {}): ClientContext => ({
  id: "ctx-1",
  workspace_id: "ws-1",
  version: 1,
  is_active: true,
  main_context: "Contexte initial.",
  positioning: "Positionnement initial.",
  audience: null,
  tone_of_voice: "Sobre.",
  pillars: [],
  mentions: null,
  restrictions: "Pas d'emoji.",
  platforms: {},
  deliverables: { intentions: "", publications: [] },
  created_at: "2026-08-01T00:00:00Z",
  created_by: null,
  ...overrides,
});

const makeProposal = (overrides: Partial<ContextProposal> = {}): ContextProposal => ({
  main_context: "Contexte initial.",
  positioning: "Positionnement enrichi.",
  audience: "Femmes 25-45 ans.",
  tone_of_voice: "Sobre.",
  pillars: [],
  mentions: "",
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
    expect(byKey.positioning!.changed).toBe(true);
    expect(byKey.audience!.changed).toBe(true);
    expect(byKey.audience!.before).toBe("");
    expect(byKey.audience!.after).toBe("Femmes 25-45 ans.");
  });

  it("compare depuis un brief inexistant : tout champ proposé non vide est un changement", () => {
    const diff = buildContextDiff(null, makeProposal());
    const changedKeys = diff.filter((entry) => entry.changed).map((entry) => entry.key);

    expect(changedKeys).toContain("main_context");
    expect(changedKeys).not.toContain("mentions");
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
          },
        ],
      }),
    );
    const pillars = diff.find((entry) => entry.key === "pillars")!;

    expect(pillars.changed).toBe(true);
    expect(pillars.after).toContain("Atelier");
    expect(pillars.after).toContain("Formats : Reels");
    expect(pillars.after).toContain("Fréquence : 2 par mois");
  });
});

describe("mergeProposal", () => {
  it("applique la proposition sur les seuls champs acceptés", () => {
    const merged = mergeProposal(makeContext(), makeProposal(), ["positioning"]);

    expect(merged.positioning).toBe("Positionnement enrichi.");
    // Refusé : la valeur actuelle reste, l'audience proposée est perdue.
    expect(merged.audience).toBe("");
    expect(merged.main_context).toBe("Contexte initial.");
  });

  it("n'écrase jamais un champ refusé, même vide dans la proposition", () => {
    const merged = mergeProposal(
      makeContext({ mentions: "Mention manuelle précieuse." }),
      makeProposal({ mentions: "" }),
      [],
    );

    expect(merged.mentions).toBe("Mention manuelle précieuse.");
  });

  it("part d'un brief vide quand aucun n'existe", () => {
    const merged = mergeProposal(null, makeProposal(), ["audience"]);

    expect(merged.audience).toBe("Femmes 25-45 ans.");
    expect(merged.main_context).toBe("");
    expect(merged.pillars).toEqual([]);
  });
});
