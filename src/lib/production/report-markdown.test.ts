import { describe, expect, it } from "vitest";

import {
  REPORT_SECTION_KEPT,
  extractReportSection,
  firstSentence,
  parseReport,
  parseSpans,
  renderRecentReports,
  summaryParagraph,
} from "./report-markdown";

describe("parseSpans", () => {
  it("isole le gras et laisse le reste en texte", () => {
    expect(parseSpans("La **portée** progresse")).toEqual([
      { text: "La ", strong: false },
      { text: "portée", strong: true },
      { text: " progresse", strong: false },
    ]);
  });

  it("laisse une étoile orpheline telle quelle", () => {
    expect(parseSpans("2 * 3 astérisques")).toEqual([
      { text: "2 * 3 astérisques", strong: false },
    ]);
  });
});

describe("parseReport", () => {
  it("reconnaît les titres et plafonne leur niveau", () => {
    expect(parseReport("# Un\n##### Cinq")).toEqual([
      { kind: "heading", level: 1, text: "Un" },
      // La page n'a pas de style au-delà du niveau 3 : mieux vaut un titre
      // trop gros qu'un titre invisible.
      { kind: "heading", level: 3, text: "Cinq" },
    ]);
  });

  it("regroupe les puces consécutives en une seule liste", () => {
    const blocks = parseReport("- un\n- deux\n\n- trois");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ kind: "list" });
    expect((blocks[0] as { items: unknown[] }).items).toHaveLength(2);
  });

  it("accepte aussi les listes numérotées", () => {
    const blocks = parseReport("1. premier\n2) second");
    expect((blocks[0] as { items: unknown[] }).items).toHaveLength(2);
  });

  it("retombe en paragraphe sur ce qu'il ne reconnaît pas", () => {
    // Un rapport hors format doit rester lisible, pas disparaître.
    expect(parseReport("Texte simple")).toEqual([
      { kind: "paragraph", spans: [{ text: "Texte simple", strong: false }] },
    ]);
  });
});

describe("firstSentence", () => {
  it("prend la première phrase du premier paragraphe, titre ignoré", () => {
    expect(
      firstSentence("### Synthèse\nJuillet progresse de 12 %. Le reste suit."),
    ).toBe("Juillet progresse de 12 %.");
  });

  it("coupe une phrase trop longue plutôt que de déborder", () => {
    expect(firstSentence(`${"a".repeat(200)}.`, 20)).toHaveLength(20);
  });

  it("rend une chaîne vide quand il n'y a aucun paragraphe", () => {
    expect(firstSentence("### Titre seul\n- une puce")).toBe("");
  });
});

describe("summaryParagraph", () => {
  it("rend le premier paragraphe entier quand il tient dans la limite", () => {
    expect(
      summaryParagraph("### Synthèse\nJuillet progresse de 12 %. Le CPA baisse."),
    ).toBe("Juillet progresse de 12 %. Le CPA baisse.");
  });

  it("coupe en fin de phrase, jamais au milieu d'un chiffre", () => {
    const long = "Première phrase courte. Seconde phrase qui dépasse largement la limite fixée pour ce résumé.";
    expect(summaryParagraph(long, 30)).toBe("Première phrase courte.");
  });

  it("tronque avec une ellipse quand aucune phrase entière ne tient", () => {
    expect(summaryParagraph(`${"a".repeat(200)}.`, 20)).toHaveLength(20);
  });

  it("rend une chaîne vide quand il n'y a aucun paragraphe", () => {
    expect(summaryParagraph("### Titre seul\n- une puce")).toBe("");
  });
});

describe("extractReportSection", () => {
  const rapport = [
    "### 1. Synthèse",
    "Le mois a porté.",
    "",
    "### 6. Mécaniques retenues",
    "- Question courte + « essayez en boutique » — 6,4 % d'engagement.",
    "- Chiffre en ouverture, en carrousel.",
    "",
    "### 7. Mécaniques à retirer",
    "- Accroche en affirmation molle — 0,9 %.",
  ].join("\n");

  it("rend le corps de la section demandée, titre numéroté compris", () => {
    // Le modèle numérote ses titres : « 6. Mécaniques retenues ».
    const section = extractReportSection(rapport, REPORT_SECTION_KEPT);
    expect(section).toContain("essayez en boutique");
    expect(section).toContain("Chiffre en ouverture");
  });

  it("s'arrête au titre suivant", () => {
    expect(extractReportSection(rapport, REPORT_SECTION_KEPT)).not.toContain("affirmation molle");
  });

  it("ignore les accents et la casse du titre", () => {
    expect(extractReportSection("### MECANIQUES RETENUES\n- Une.", REPORT_SECTION_KEPT)).toBe(
      "- Une.",
    );
  });

  it("rend une chaîne vide quand la section n'existe pas", () => {
    // Un compte rendu antérieur à cette structure ne doit rien faire échouer.
    expect(extractReportSection("### Synthèse\nRien.", REPORT_SECTION_KEPT)).toBe("");
  });
});

describe("renderRecentReports", () => {
  it("nomme le mois analysé de chaque synthèse", () => {
    // La phase Reporting analyse M−1 quand les Intentions visent M+1 : sans
    // étiquette, le modèle daterait les enseignements du mois qu'il prépare.
    const rendu = renderRecentReports([
      { monthLabel: "juillet 2026", report: "### Mécaniques retenues\n- La question courte." },
    ]);
    expect(rendu).toContain("--- Analyse du mois de juillet 2026 ---");
    expect(rendu).toContain("La question courte.");
  });

  it("retombe sur le résumé d'un compte rendu sans sections normalisées, et le dit", () => {
    const rendu = renderRecentReports([
      { monthLabel: "juin 2026", report: "### Synthèse\nLa portée a doublé." },
    ]);
    expect(rendu).toContain("antérieur aux sections normalisées");
    expect(rendu).toContain("La portée a doublé.");
  });

  it("ne rend rien quand il n'y a aucune synthèse", () => {
    expect(renderRecentReports([])).toBe("");
  });
});
