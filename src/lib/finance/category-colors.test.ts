import { describe, expect, it } from "vitest";

import {
  assignCategoryColors,
  CATEGORY_PALETTE,
  categoryColor,
} from "./category-colors";

describe("categoryColor", () => {
  it("rend la même couleur à chaque appel — elle suit l'entité, pas le rang", () => {
    expect(categoryColor("salaires")).toBe(categoryColor("salaires"));
    expect(categoryColor("Salaires")).toBe(categoryColor("salaires "));
  });

  it("disperse les sept catégories du plan par défaut sans collision", () => {
    const slugs = [
      "virements",
      "restauration",
      "logiciels",
      "marketing",
      "transports",
      "frais",
      "voyages",
    ];
    const colors = slugs.map(categoryColor);
    expect(new Set(colors).size).toBe(slugs.length);
  });

  it("ne tire ses teintes que de la rampe de répartition, jamais d'un hexadécimal", () => {
    /* Le camembert et l'histogramme des sources de trafic partagent la même
       rampe verte : `--share-2/4/6` valent `--ordinal-1/2/3` dans la feuille
       de style, une seule source pour la même teinte. Un hexadécimal posé ici
       finirait par diverger, et ne s'inverserait pas en mode sombre. */
    expect(CATEGORY_PALETTE).toHaveLength(7);
    for (const teinte of CATEGORY_PALETTE) {
      expect(teinte).toMatch(/^var\(--share-[1-7]\)$/);
    }
    expect(new Set(CATEGORY_PALETTE).size).toBe(CATEGORY_PALETTE.length);
  });

  it("ne rend jamais autre chose qu'une teinte de la gamme", () => {
    for (const name of ["Salaires", "Comptabilité", "Matériel", "Assurance", "x"]) {
      expect(CATEGORY_PALETTE).toContain(categoryColor(name));
    }
  });

  it("est insensible à l'écriture — même slug, même couleur", () => {
    expect(categoryColor("Matériel")).toBe(categoryColor("materiel"));
  });
});

describe("assignCategoryColors", () => {
  it("ne rend jamais deux fois la même teinte dans un même camembert", () => {
    /* « Voyage », « Autre » et « Transports » tombent tous les trois sur le
       pas du hachage n° 1, celui que « Restauration » occupe en dur : quatre
       parts du même vert sur le même écran, vues au navigateur. */
    const couleurs = assignCategoryColors(["restauration", "voyage", "autre", "transports"]);
    expect(new Set(couleurs.values()).size).toBe(4);
  });

  it("laisse la première servie sur son pas — c'est la suivante qui se décale", () => {
    const couleurs = assignCategoryColors(["restauration", "voyage"]);
    expect(couleurs.get("restauration")).toBe(categoryColor("restauration"));
    expect(couleurs.get("voyage")).not.toBe(categoryColor("restauration"));
  });

  it("garde leur teinte aux sept catégories du plan, qui ne se disputent rien", () => {
    const slugs = [
      "virements",
      "restauration",
      "logiciels",
      "marketing",
      "transports",
      "frais",
      "voyages",
    ];
    const couleurs = assignCategoryColors(slugs);
    for (const slug of slugs) expect(couleurs.get(slug)).toBe(categoryColor(slug));
  });

  it("rend la même chose à chaque appel pour un même jeu", () => {
    const jeu = ["voyage", "autre", "materiel"];
    expect([...assignCategoryColors(jeu).values()]).toEqual([...assignCategoryColors(jeu).values()]);
  });

  it("tolère plus de catégories que de pas sans boucler à l'infini", () => {
    const trop = Array.from({ length: 12 }, (_, index) => `categorie-${index}`);
    const couleurs = assignCategoryColors(trop);
    expect(couleurs.size).toBe(12);
    for (const teinte of couleurs.values()) expect(CATEGORY_PALETTE).toContain(teinte);
  });
});
