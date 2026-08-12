import { describe, expect, it } from "vitest";

import {
  normalizeDeliverables,
  renderDeliverables,
  summarizeDeliverables,
  totalPublications,
} from "./deliverables";
import type { ContextDeliverables } from "./types";

const deliverables = (
  overrides: Partial<ContextDeliverables> = {},
): ContextDeliverables => ({
  intentions: "",
  publications: [],
  reseaux: [],
  ...overrides,
});

describe("normalizeDeliverables", () => {
  it("rend la forme vide pour une valeur absente ou mal formée", () => {
    expect(normalizeDeliverables(null)).toEqual({
      intentions: "",
      publications: [],
      reseaux: [],
    });
    expect(normalizeDeliverables("livrables")).toEqual({
      intentions: "",
      publications: [],
      reseaux: [],
    });
    expect(normalizeDeliverables([{ categorie: "Reels" }])).toEqual({
      intentions: "",
      publications: [],
      reseaux: [],
    });
  });

  it("garde les lignes valides et écarte celles sans catégorie", () => {
    const result = normalizeDeliverables({
      intentions: "  le 20 du mois précédent  ",
      publications: [
        { categorie: " Reels ", quantite: 2 },
        { categorie: "   ", quantite: 5 },
      ],
    });

    expect(result.intentions).toBe("le 20 du mois précédent");
    expect(result.publications).toEqual([{ categorie: "Reels", quantite: 2 }]);
  });

  it("dédoublonne les réseaux sans tenir compte de la casse ni des accents", () => {
    const result = normalizeDeliverables({
      reseaux: ["Instagram", " instagram ", "LinkedIn", "", 42, "Le Bon Coin"],
    });

    expect(result.reseaux).toEqual(["Instagram", "LinkedIn", "Le Bon Coin"]);
  });

  it("ramène une quantité illisible à zéro plutôt que de casser la page", () => {
    const result = normalizeDeliverables({
      publications: [
        { categorie: "Stories", quantite: "huit" },
        { categorie: "Post fixe", quantite: -3 },
        { categorie: "Carrousel", quantite: 2.6 },
      ],
    });

    expect(result.publications).toEqual([
      { categorie: "Stories", quantite: 0 },
      { categorie: "Post fixe", quantite: 0 },
      { categorie: "Carrousel", quantite: 3 },
    ]);
  });
});

describe("totalPublications", () => {
  it("additionne les quantités de toutes les catégories", () => {
    const total = totalPublications(
      deliverables({
        publications: [
          { categorie: "Reels", quantite: 2 },
          { categorie: "Stories", quantite: 8 },
        ],
      }),
    );

    expect(total).toBe(10);
  });

  it("vaut zéro sans aucune ligne", () => {
    expect(totalPublications(deliverables())).toBe(0);
  });
});

describe("summarizeDeliverables", () => {
  it("compose la phrase de contexte et saute les catégories à zéro", () => {
    const summary = summarizeDeliverables(
      deliverables({
        publications: [
          { categorie: "Post fixe", quantite: 4 },
          { categorie: "Reels", quantite: 0 },
          { categorie: "Stories", quantite: 8 },
        ],
      }),
    );

    expect(summary).toBe("4 post fixe, 8 stories");
  });
});

describe("renderDeliverables", () => {
  it("met le volume et la date de livraison à plat pour les prompts", () => {
    const rendered = renderDeliverables(
      deliverables({
        intentions: "le 20 du mois précédent",
        publications: [
          { categorie: "Reels", quantite: 2 },
          { categorie: "Stories", quantite: 8 },
        ],
      }),
    );

    expect(rendered).toContain("- Reels : 2 par mois");
    expect(rendered).toContain("Total : 10 publications par mois.");
    expect(rendered).toContain("Livraison des intentions : le 20 du mois précédent.");
  });

  it("accorde le singulier sur une seule publication", () => {
    const rendered = renderDeliverables(
      deliverables({ publications: [{ categorie: "Reels", quantite: 1 }] }),
    );

    expect(rendered).toContain("Total : 1 publication par mois.");
  });

  it("annonce les réseaux avant le volume", () => {
    const rendered = renderDeliverables(
      deliverables({
        reseaux: ["Instagram", "LinkedIn"],
        publications: [{ categorie: "Reels", quantite: 2 }],
      }),
    );

    expect(rendered.startsWith("Réseaux du client : Instagram, LinkedIn.")).toBe(true);
  });

  it("ne rend rien quand aucun livrable n'est renseigné", () => {
    expect(renderDeliverables(deliverables())).toBe("");
    expect(
      renderDeliverables(deliverables({ publications: [{ categorie: "Reels", quantite: 0 }] })),
    ).toBe("");
  });
});
