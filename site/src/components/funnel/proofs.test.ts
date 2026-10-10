import { describe, expect, it } from "vitest";

import { getDictionary } from "@/i18n";
import { CASE_VISUALS } from "@/lib/cases";

import { proofSlides } from "./proofs";

describe("proofSlides", () => {
  for (const locale of ["fr", "en"] as const) {
    it(`pose chaque chiffre sur une publication de son client, jamais d'un autre (${locale})`, () => {
      const dict = getDictionary(locale);
      const slides = proofSlides(dict.funnel.panel, dict.cases.items);
      expect(slides).toHaveLength(dict.funnel.panel.length);
      for (const slide of slides) {
        const caseId = dict.cases.items.find((item) => item.client === slide.client)?.id;
        if (slide.client === "Catherine Osti") {
          expect(slide).toMatchObject({ poster: "/cas/catherine-osti-proof.webp", handle: null });
          continue;
        }
        if (!caseId) {
          expect(slide.poster).toBeNull();
          expect(slide.handle).toBeNull();
          continue;
        }
        const own = CASE_VISUALS[caseId] ?? [];
        expect(own.some((visual) => visual.poster === slide.poster && visual.handle === slide.handle)).toBe(true);
      }
    });
  }

  it("Bondet sur ses solaires, Chasseurs de Graines sur le grain, Catherine Osti sur son portrait", () => {
    const dict = getDictionary("fr");
    const byClient = Object.fromEntries(proofSlides(dict.funnel.panel, dict.cases.items).map((slide) => [slide.client, slide]));
    expect(byClient["Lunettes Bondet"]).toMatchObject({ poster: "/cas/bondet-solaire.webp", handle: "@lunettesbondet" });
    expect(byClient["Chasseurs de Graines"]).toMatchObject({ poster: "/cas/anmf-spot.webp", handle: "@chasseursdegraines" });
    expect(byClient["Catherine Osti"]).toMatchObject({ poster: "/cas/catherine-osti-proof.webp", handle: null });
  });

  it("un client inconnu garde le fond de la Profondeur", () => {
    const [slide] = proofSlides([{ value: "1", label: "x", client: "Inconnu", source: "s" }], []);
    expect(slide).toMatchObject({ poster: null, handle: null });
  });
});
