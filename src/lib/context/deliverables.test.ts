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
  reseaux: [],
  publications: [],
  ...overrides,
});

const VIDE = { intentions: "", reseaux: [], publications: [] };

describe("normalizeDeliverables", () => {
  it("rend la forme vide pour une valeur absente ou mal formée", () => {
    expect(normalizeDeliverables(null)).toEqual(VIDE);
    expect(normalizeDeliverables("livrables")).toEqual(VIDE);
    expect(normalizeDeliverables([{ categorie: "Reels" }])).toEqual(VIDE);
  });

  it("lit l'ancienne forme, où les réseaux n'étaient que des noms", () => {
    const result = normalizeDeliverables({
      intentions: "le 20",
      reseaux: ["Instagram", "LinkedIn"],
      publications: [{ categorie: "Reels", quantite: 2 }],
    });

    expect(result.reseaux).toEqual([
      { nom: "Instagram", publications: [] },
      { nom: "LinkedIn", publications: [] },
    ]);
    // Le volume d'avant n'est attribué à personne : il reste hors réseau.
    expect(result.publications).toEqual([{ categorie: "Reels", quantite: 2 }]);
  });

  it("garde les lignes valides de chaque réseau et écarte celles sans catégorie", () => {
    const result = normalizeDeliverables({
      intentions: "  le 20 du mois précédent  ",
      reseaux: [
        {
          nom: " Instagram ",
          publications: [
            { categorie: " Reels ", quantite: 2 },
            { categorie: "   ", quantite: 5 },
          ],
        },
      ],
    });

    expect(result.intentions).toBe("le 20 du mois précédent");
    expect(result.reseaux).toEqual([
      { nom: "Instagram", publications: [{ categorie: "Reels", quantite: 2 }] },
    ]);
  });

  it("dédoublonne les réseaux sans tenir compte de la casse et fusionne leurs lignes", () => {
    const result = normalizeDeliverables({
      reseaux: [
        { nom: "Instagram", publications: [{ categorie: "Reels", quantite: 2 }] },
        { nom: " instagram ", publications: [{ categorie: "Stories", quantite: 8 }] },
        { nom: "", publications: [{ categorie: "Post", quantite: 1 }] },
      ],
    });

    expect(result.reseaux).toEqual([
      {
        nom: "Instagram",
        publications: [
          { categorie: "Reels", quantite: 2 },
          { categorie: "Stories", quantite: 8 },
        ],
      },
    ]);
  });

  it("ramène une quantité illisible à zéro plutôt que de casser la page", () => {
    const result = normalizeDeliverables({
      reseaux: [
        {
          nom: "Instagram",
          publications: [
            { categorie: "Stories", quantite: "huit" },
            { categorie: "Post fixe", quantite: -3 },
            { categorie: "Carrousel", quantite: 2.6 },
          ],
        },
      ],
    });

    expect(result.reseaux[0]!.publications).toEqual([
      { categorie: "Stories", quantite: 0 },
      { categorie: "Post fixe", quantite: 0 },
      { categorie: "Carrousel", quantite: 3 },
    ]);
  });
});

describe("totalPublications", () => {
  it("additionne tous les réseaux et ce qui n'est rattaché à aucun", () => {
    const total = totalPublications(
      deliverables({
        reseaux: [
          {
            nom: "Instagram",
            publications: [
              { categorie: "Reels", quantite: 2 },
              { categorie: "Stories", quantite: 8 },
            ],
          },
          { nom: "LinkedIn", publications: [{ categorie: "Article", quantite: 2 }] },
        ],
        publications: [{ categorie: "Newsletter", quantite: 1 }],
      }),
    );

    expect(total).toBe(13);
  });

  it("vaut zéro sans aucune ligne", () => {
    expect(totalPublications(deliverables())).toBe(0);
  });
});

describe("summarizeDeliverables", () => {
  it("dit la répartition par réseau et saute ceux qui n'ont rien", () => {
    const summary = summarizeDeliverables(
      deliverables({
        reseaux: [
          { nom: "Instagram", publications: [{ categorie: "Reels", quantite: 14 }] },
          { nom: "LinkedIn", publications: [{ categorie: "Article", quantite: 2 }] },
          { nom: "TikTok", publications: [] },
        ],
        publications: [{ categorie: "Newsletter", quantite: 1 }],
      }),
    );

    expect(summary).toBe("14 sur Instagram, 2 sur LinkedIn, 1 hors réseau");
  });
});

describe("renderDeliverables", () => {
  it("détaille le volume réseau par réseau pour les prompts", () => {
    const rendered = renderDeliverables(
      deliverables({
        intentions: "le 20 du mois précédent",
        reseaux: [
          {
            nom: "Instagram",
            publications: [
              { categorie: "Reels", quantite: 2 },
              { categorie: "Stories", quantite: 8 },
            ],
          },
          { nom: "LinkedIn", publications: [{ categorie: "Article", quantite: 2 }] },
        ],
      }),
    );

    expect(rendered.startsWith("Réseaux du client : Instagram, LinkedIn.")).toBe(true);
    expect(rendered).toContain("- Instagram : 2 Reels, 8 Stories (10 par mois)");
    expect(rendered).toContain("- LinkedIn : 2 Article (2 par mois)");
    expect(rendered).toContain("Total : 12 publications par mois.");
    expect(rendered).toContain("Livraison des intentions : le 20 du mois précédent.");
  });

  it("annonce à part ce qui n'est rattaché à aucun réseau", () => {
    const rendered = renderDeliverables(
      deliverables({ publications: [{ categorie: "Newsletter", quantite: 1 }] }),
    );

    expect(rendered).toContain("- Hors réseau : 1 Newsletter");
    expect(rendered).toContain("Total : 1 publication par mois.");
  });

  it("ne rend rien quand aucun livrable n'est renseigné", () => {
    expect(renderDeliverables(deliverables())).toBe("");
    expect(
      renderDeliverables(
        deliverables({
          reseaux: [{ nom: "Instagram", publications: [{ categorie: "Reels", quantite: 0 }] }],
        }),
      ),
    ).toBe("Réseaux du client : Instagram.");
  });
});
