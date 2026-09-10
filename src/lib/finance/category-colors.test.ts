import { describe, expect, it } from "vitest";

import {
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

  it("emprunte ses verts à la rampe ordinale du Reporting, jetons compris", () => {
    /* Le camembert et l'histogramme des sources de trafic partagent la même
       rampe : deux gammes de verts voisines se liraient comme un défaut. */
    for (const jeton of ["var(--ordinal-1)", "var(--ordinal-2)", "var(--ordinal-3)"]) {
      expect(CATEGORY_PALETTE).toContain(jeton);
    }
    // Et aucun vert en dur à côté : deux sources pour la même teinte
    // finiraient par diverger, et l'hexadécimal ne s'inverse pas en sombre.
    expect(CATEGORY_PALETTE.filter((teinte) => teinte.startsWith("var("))).toHaveLength(3);
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
