import { describe, expect, it } from "vitest";

import { parseProposal } from "./proposal";

const validPayload = () => ({
  contexte_principal: "Marque horlogère familiale, entrée de gamme 1 200 EUR.",
  positionnement: "Le luxe accessible.",
  cibles: "Hommes 30-50 ans, CSP+.",
  tone_of_voice: "Sobre, précis.",
  piliers: [
    {
      nom: "Atelier et savoir-faire",
      description: "Coulisses de fabrication.",
      formats: ["Reels", "Carrousel"],
      angles: ["portrait d'artisan", "gros plan matière"],
      frequence: "2 par mois",
    },
  ],
  mentions: "Fabriqué en France.",
  interdits: "Jamais de prix barrés.",
  plateformes: { instagram: "Tutoiement, 3 hashtags.", linkedin: "", tiktok: "", facebook: "" },
});

describe("parseProposal", () => {
  it("traduit les clés françaises du modèle vers les colonnes de la base", () => {
    const proposal = parseProposal(validPayload());

    expect(proposal).not.toBeNull();
    expect(proposal!.main_context).toContain("horlogère");
    expect(proposal!.audience).toContain("30-50");
    expect(proposal!.restrictions).toBe("Jamais de prix barrés.");
    expect(proposal!.pillars[0]!.nom).toBe("Atelier et savoir-faire");
    expect(proposal!.platforms.instagram).toContain("Tutoiement");
  });

  it("accepte des champs vides sans les inventer", () => {
    const proposal = parseProposal({ contexte_principal: "", piliers: [] });

    expect(proposal).not.toBeNull();
    expect(proposal!.main_context).toBe("");
    expect(proposal!.pillars).toEqual([]);
    expect(proposal!.platforms).toEqual({});
  });

  it("rejette une sortie qui n'est pas un objet", () => {
    expect(parseProposal(null)).toBeNull();
    expect(parseProposal("du texte")).toBeNull();
    expect(parseProposal([1, 2])).toBeNull();
  });

  it("écarte les piliers malformés et garde les valides", () => {
    const proposal = parseProposal({
      piliers: [
        "pas un objet",
        { nom: "", description: "" },
        { nom: "Valide", description: "Un pilier.", formats: "pas un tableau" },
      ],
    });

    expect(proposal!.pillars).toHaveLength(1);
    expect(proposal!.pillars[0]).toEqual({
      nom: "Valide",
      description: "Un pilier.",
      formats: [],
      angles: [],
      frequence: "",
    });
  });

  it("normalise les clés de plateforme en minuscules", () => {
    const proposal = parseProposal({ plateformes: { Instagram: "Règle.", "": "ignorée" } });
    expect(proposal!.platforms).toEqual({ instagram: "Règle." });
  });
});
