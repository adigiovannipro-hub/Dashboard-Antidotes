import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Rich, plainText } from "./rich";

function render(text: string, lines?: boolean): string {
  return renderToStaticMarkup(createElement(Rich, { text, lines }));
}

describe("Rich", () => {
  it("rend le mot-clé en vert et la touche manuscrite en italique", () => {
    expect(render("Des réseaux *qui rapportent*, _chiffres à l'appui._")).toBe(
      'Des réseaux <span class="kw">qui rapportent</span>, <em class="serif">chiffres à l&#x27;appui.</em>',
    );
  });
  it("coupe la ligne par un <br /> à chaque \\n, par défaut", () => {
    expect(render("Des réseaux sociaux\n*qui rapportent*,\n_chiffres à l'appui._")).toBe(
      'Des réseaux sociaux<br/><span class="kw">qui rapportent</span>,<br/><em class="serif">chiffres à l&#x27;appui.</em>',
    );
  });
  it("rend chaque ligne dans son propre bloc avec lines", () => {
    expect(render("Des réseaux sociaux\n*qui rapportent*,\n_chiffres à l'appui._", true)).toBe(
      '<span class="block">Des réseaux sociaux</span><span class="block"><span class="kw">qui rapportent</span>,</span><span class="block"><em class="serif">chiffres à l&#x27;appui.</em></span>',
    );
  });
  it("ne laisse aucune marque traverser un retour à la ligne", () => {
    expect(render("un *mot\nclé* coupé")).toBe("un *mot<br/>clé* coupé");
  });
  it("rend un texte sans \\n tel quel, dans un seul bloc avec lines", () => {
    expect(render("Votre rendez-vous", true)).toBe('<span class="block">Votre rendez-vous</span>');
  });
});

describe("plainText", () => {
  it("retire les marques du mot-clé et de l'italique sans toucher au texte", () => {
    expect(plainText("Des réseaux sociaux *qui rapportent*, _chiffres à l'appui._")).toBe("Des réseaux sociaux qui rapportent, chiffres à l'appui.");
  });
  it("remplace chaque \\n par une espace", () => {
    expect(plainText("Des réseaux sociaux\n*qui rapportent*,\n_chiffres à l'appui._")).toBe("Des réseaux sociaux qui rapportent, chiffres à l'appui.");
    expect(plainText("Social channels \n*that deliver*, with\r\nthe numbers _to prove it._")).toBe("Social channels that deliver, with the numbers to prove it.");
  });
  it("laisse intact un texte sans marque", () => {
    expect(plainText("Votre rendez-vous")).toBe("Votre rendez-vous");
  });
});
