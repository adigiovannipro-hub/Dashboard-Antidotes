import { describe, expect, it } from "vitest";

import { renderTextToPdf, textWidth, tidyBody, wrapLines } from "./text-pdf";

describe("tidyBody", () => {
  it("réduit les blancs d'un HTML converti à une ligne vide au plus", () => {
    // Un reçu HTML converti laisse une ligne par cellule de tableau : rendu
    // tel quel, le reçu Grab tenait sur cinq pages presque blanches.
    expect(tidyBody("Total\n\n\n\n\n381 700 IDR")).toBe("Total\n\n381 700 IDR");
  });

  it("supprime les blancs de tête et de queue", () => {
    expect(tidyBody("\n\n  Reçu  \n\n\n")).toBe("Reçu");
  });

  it("ramène les espaces exotiques à l'espace ordinaire", () => {
    // L'espace insécable fine des montants sortait « ? » à l'encodage.
    expect(tidyBody("381 700 IDR")).toBe("381 700 IDR");
    expect(tidyBody("a​b")).toBe("ab");
  });
});

describe("textWidth", () => {
  it("distingue les capitales des bas de casse", () => {
    // Une moyenne unique faisait déborder les références en capitales : « A »
    // est trois fois plus large que « l ».
    expect(textWidth("A")).toBeGreaterThan(textWidth("l") * 2.5);
  });

  it("croît avec la longueur et avec le corps", () => {
    expect(textWidth("abcd")).toBeGreaterThan(textWidth("abc"));
    expect(textWidth("abc", 20)).toBeCloseTo(textWidth("abc", 10) * 2, 5);
  });
});

describe("wrapLines", () => {
  it("coupe aux mots sans jamais dépasser la largeur", () => {
    const texte =
      "Merci d'avoir voyagé avec Grab, voici le détail de votre trajet du 7 août 2026 entre Uluwatu et Tampah Hills.";
    for (const ligne of wrapLines(texte, 200)) {
      expect(textWidth(ligne)).toBeLessThanOrEqual(200);
    }
  });

  it("casse un mot plus long que la ligne plutôt que de le laisser déborder", () => {
    // Une référence bancaire sans espace n'a aucun point de coupure naturel.
    const lignes = wrapLines("A".repeat(300), 100);
    expect(lignes.length).toBeGreaterThan(1);
    for (const ligne of lignes) {
      expect(textWidth(ligne)).toBeLessThanOrEqual(100);
    }
    expect(lignes.join("")).toBe("A".repeat(300));
  });

  it("préserve les lignes vides, qui portent la structure du reçu", () => {
    expect(wrapLines("un\n\ndeux", 500)).toEqual(["un", "", "deux"]);
  });
});

describe("renderTextToPdf", () => {
  const pdf = renderTextToPdf({
    title: "Votre reçu Grab",
    meta: ["Marchand : Grab", "Montant : 154 400,00 IDR"],
    body: "Trajet du 7 août 2026\nTotal payé 154 400 IDR",
  });
  const texte = pdf.toString("latin1");

  it("produit un fichier PDF complet, de l'en-tête au marqueur de fin", () => {
    expect(pdf.subarray(0, 8).toString()).toBe("%PDF-1.4");
    expect(texte.endsWith("%%EOF\n")).toBe(true);
    expect(texte).toContain("/Type /Catalog");
    expect(texte).toContain("/BaseFont /Helvetica");
    expect(texte).toContain("startxref");
  });

  it("écrit le contenu en clair — c'est du texte, pas une image", () => {
    // Ce qui distingue ce PDF d'une capture d'écran : Airwallex n'a pas à
    // deviner les caractères, il les lit.
    expect(texte).toContain("Votre re\xE7u Grab");
    expect(texte).toContain("Total pay\xE9 154 400 IDR");
    expect(texte).toContain("Marchand : Grab");
  });

  it("encode les signes hors Latin-1 selon WinAnsi", () => {
    const avecEuro = renderTextToPdf({ title: "T", body: "Total : 12,00 €" });
    // L'euro vaut 0x80 en WinAnsi, une position vide en Latin-1 : sans la
    // table, il sortirait en caractère de contrôle.
    expect(avecEuro.includes(Buffer.from([0x80]))).toBe(true);
  });

  it("écrit un montant à espace fine sans point d'interrogation", () => {
    const montant = renderTextToPdf({
      title: "T",
      meta: ["Montant : 381 700 IDR"],
      body: "Total 381 700 IDR",
    });
    expect(montant.toString("latin1")).toContain("Montant : 381 700 IDR");
    expect(montant.toString("latin1")).not.toContain("381?700");
  });

  it("échappe les caractères que la syntaxe PDF réserve", () => {
    const risque = renderTextToPdf({ title: "T", body: "Montant (net) \\ TVA" });
    expect(risque.toString("latin1")).toContain("Montant \\(net\\) \\\\ TVA");
  });

  it("pagine un long corps plutôt que de déborder la page", () => {
    const long = renderTextToPdf({
      title: "Relevé",
      body: Array.from({ length: 200 }, (_, index) => `Ligne ${index}`).join("\n"),
    });
    const pages = /\/Count (\d+)/.exec(long.toString("latin1"));
    expect(Number(pages?.[1])).toBeGreaterThan(1);
  });

  it("rend un document valide même sans corps", () => {
    const vide = renderTextToPdf({ title: "Reçu", body: "" });
    expect(vide.subarray(0, 8).toString()).toBe("%PDF-1.4");
    expect(vide.toString("latin1")).toContain("/Count 1");
  });
});
