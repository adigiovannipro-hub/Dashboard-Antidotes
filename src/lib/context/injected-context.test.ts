import { describe, expect, it } from "vitest";

import {
  buildContextSections,
  extractPlatformRules,
  renderAssetSummaries,
  renderBrief,
  renderContextSections,
  totalContextTokens,
} from "./injected-context";
import type {
  ClientAsset,
  ClientContext,
  ClientGenerationSettings,
} from "./types";

const MAINTENANT = new Date("2026-09-11T10:00:00.000Z");

const makeContext = (overrides: Partial<ClientContext> = {}): ClientContext => ({
  id: "ctx-1",
  workspace_id: "ws-1",
  version: 1,
  is_active: true,
  main_context: "Marque de maroquinerie lyonnaise.",
  audience: null,
  tone_of_voice: null,
  pillars: [],
  restrictions: "Jamais de solde affichée.",
  platforms: { instagram: "Tutoiement.", linkedin: "  " },
  deliverables: { intentions: "", reseaux: [], publications: [] },
  validated_examples: [],
  client_feedback: null,
  sourced_facts: [],
  created_at: "2026-08-01T00:00:00Z",
  created_by: null,
  ...overrides,
});

const makeAsset = (overrides: Partial<ClientAsset> = {}): ClientAsset => ({
  id: "asset-1",
  workspace_id: "ws-1",
  name: "strategie-2026.pdf",
  type: "strategy",
  storage_path: "ws-1/contexte/strategie-2026.pdf",
  mime_type: "application/pdf",
  size_bytes: 1000,
  summary: "Trois piliers : atelier, produit, communauté.",
  summary_edited_manually: false,
  include_in_context: true,
  extraction_status: "done",
  extraction_error: null,
  created_at: "2026-08-01T00:00:00Z",
  ...overrides,
});

const makeSettings = (
  overrides: Partial<ClientGenerationSettings> = {},
): ClientGenerationSettings => ({
  workspace_id: "ws-1",
  permanent_instructions: null,
  monthly_instruction: null,
  monthly_instruction_month: null,
  temporal_context: null,
  temporal_context_at: null,
  updated_at: "2026-09-01T00:00:00Z",
  updated_by: null,
  ...overrides,
});

const build = (overrides: Partial<Parameters<typeof buildContextSections>[0]> = {}) =>
  buildContextSections({
    brief: makeContext(),
    assets: [],
    settings: null,
    accroches: [],
    targetMonth: "2026-10-01",
    now: MAINTENANT,
    ...overrides,
  });

const titres = (overrides: Partial<Parameters<typeof buildContextSections>[0]> = {}) =>
  build(overrides).map((section) => section.titre);

describe("renderBrief", () => {
  it("ne rend que les champs remplis, sous leur libellé", () => {
    const brief = renderBrief(makeContext());

    expect(brief).toContain("Contexte principal :");
    expect(brief).toContain("maroquinerie lyonnaise");
  });

  it("rend une chaîne vide sans brief", () => {
    expect(renderBrief(null)).toBe("");
  });
});

describe("renderAssetSummaries", () => {
  it("n'injecte que les documents cochés et résumés", () => {
    const rendered = renderAssetSummaries([
      makeAsset(),
      makeAsset({ id: "a2", include_in_context: false, summary: "Ne doit pas sortir." }),
      makeAsset({ id: "a3", summary: null }),
    ]);

    expect(rendered).toContain("[Stratégie : strategie-2026.pdf]");
    expect(rendered).toContain("Trois piliers");
    expect(rendered).not.toContain("Ne doit pas sortir.");
  });
});

describe("extractPlatformRules", () => {
  it("écarte les règles vides et garde les autres", () => {
    expect(extractPlatformRules(makeContext())).toEqual({ instagram: "Tutoiement." });
    expect(extractPlatformRules(null)).toEqual({});
  });
});

describe("buildContextSections", () => {
  it("n'écrit aucune section vide", () => {
    // Un brief à trois champs remplis rend trois sections : pas de
    // « Retours du client : (aucun) », qui coûte des tokens pour apprendre au
    // modèle qu'il n'apprendra rien.
    expect(titres()).toEqual([
      "La marque",
      "Règles par plateforme",
      "Interdits (contraignants)",
    ]);
  });

  it("rend un tableau vide quand il n'y a rien du tout", () => {
    expect(build({ brief: null })).toEqual([]);
  });

  it("suit l'ordre de concaténation décidé, de la marque à l'ajustement", () => {
    const ordre = titres({
      brief: makeContext({
        pillars: [
          {
            nom: "Atelier",
            description: "Les gestes de fabrication.",
            formats: ["Reels"],
            angles: ["Coulisses"],
            frequence: "2 par mois",
            objectif_business: "Justifier le prix",
            cta_autorises: ["Découvrir l'atelier"],
          },
        ],
        validated_examples: [{ reseau: "instagram", texte: "Le cuir se patine." }],
        client_feedback: "Ne jamais dire « iconique ».",
        sourced_facts: [
          { fait: "Atelier fondé en 1974.", source: "https://x.test", verifie_le: "2026-09-01" },
        ],
      }),
      assets: [makeAsset()],
      accroches: ["Le cuir se patine."],
      settings: makeSettings({
        permanent_instructions: "Toujours vouvoyer.",
        monthly_instruction: "Pousser la capsule.",
        monthly_instruction_month: "2026-10-01",
        temporal_context: "Salon du 12 au 15.",
        temporal_context_at: "2026-09-05T00:00:00Z",
      }),
      adjustment: "Cette fois, deux carrousels de plus.",
    });

    expect(ordre).toEqual([
      "La marque",
      "Documents de référence",
      "Piliers de contenu",
      "Règles par plateforme",
      "Interdits (contraignants)",
      "Exemples validés (registre à reproduire, jamais à recopier)",
      "Retours du client (corrections, refus, formulations bannies)",
      "Faits sourcés (seuls chiffres et affirmations autorisés)",
      "Accroches déjà utilisées — interdiction de les réécrire ou de les paraphraser",
      "Temps forts du moment",
      "Instructions permanentes",
      "Consigne du mois",
      "Ajustement demandé au lancement (prioritaire)",
    ]);
  });

  it("injecte les exemples validés entiers, réseau compris", () => {
    const sections = build({
      brief: makeContext({
        validated_examples: [
          { reseau: "LinkedIn", texte: "Trois ans que nous cherchions ce cuir." },
        ],
      }),
    });
    const exemples = sections.find((section) => section.titre.startsWith("Exemples"));
    expect(exemples?.texte).toBe("[LinkedIn]\nTrois ans que nous cherchions ce cuir.");
  });

  it("marque un fait vérifié il y a plus de six mois sans le retirer", () => {
    const sections = build({
      brief: makeContext({
        sourced_facts: [
          { fait: "40 % de croissance.", source: "https://x.test", verifie_le: "2025-01-01" },
        ],
      }),
    });
    const faits = sections.find((section) => section.titre.startsWith("Faits"));
    expect(faits?.texte).toContain("40 % de croissance.");
    expect(faits?.texte).toContain("À REVÉRIFIER");
  });

  it("n'injecte pas un contexte temporel de plus de trente jours", () => {
    expect(
      titres({
        settings: makeSettings({
          temporal_context: "Soldes d'hiver.",
          temporal_context_at: "2026-02-01T00:00:00Z",
        }),
      }),
    ).not.toContain("Temps forts du moment");
  });

  it("n'injecte pas une consigne qui vise un autre mois", () => {
    expect(
      titres({
        settings: makeSettings({
          monthly_instruction: "Pousser les soldes.",
          monthly_instruction_month: "2026-08-01",
        }),
      }),
    ).not.toContain("Consigne du mois");
  });

  it("numérote les accroches et dit qu'elles sont interdites", () => {
    const sections = build({ accroches: ["Première.", "  ", "Seconde."] });
    const negatif = sections.find((section) => section.titre.startsWith("Accroches"));
    expect(negatif?.texte).toBe("1. Première.\n2. Seconde.");
  });

  it("liste les appels à l'action autorisés comme une liste fermée", () => {
    const sections = build({
      brief: makeContext({
        pillars: [
          {
            nom: "Produit",
            description: "La matière.",
            formats: [],
            angles: [],
            frequence: "",
            cta_autorises: ["Découvrir", "Prendre rendez-vous"],
          },
        ],
      }),
    });
    const piliers = sections.find((section) => section.titre === "Piliers de contenu");
    expect(piliers?.texte).toContain("Découvrir · Prendre rendez-vous");
  });
});

describe("renderContextSections", () => {
  it("rend exactement ce que la modale affiche et ce que le prompt reçoit", () => {
    const sections = build();
    const texte = renderContextSections(sections);

    for (const section of sections) {
      expect(texte).toContain(`${section.titre} :\n${section.texte}`);
    }
  });
});

describe("totalContextTokens", () => {
  it("additionne les sections, et rien d'autre", () => {
    const sections = build();
    expect(totalContextTokens(sections)).toBe(
      sections.reduce((total, section) => total + section.tokens, 0),
    );
  });
});
