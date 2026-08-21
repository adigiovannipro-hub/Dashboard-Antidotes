import { describe, expect, it } from "vitest";

import { parseInline, parseScript } from "./markdown";

describe("parseInline", () => {
  it("reconnaît gras, italique, code et lien dans une même phrase", () => {
    expect(
      parseInline("Un **budget** de *test* à `50 €` sur [Meta](https://business.facebook.com)."),
    ).toEqual([
      { kind: "text", value: "Un " },
      { kind: "strong", value: "budget" },
      { kind: "text", value: " de " },
      { kind: "em", value: "test" },
      { kind: "text", value: " à " },
      { kind: "code", value: "50 €" },
      { kind: "text", value: " sur " },
      { kind: "link", value: "Meta", href: "https://business.facebook.com" },
      { kind: "text", value: "." },
    ]);
  });

  it("ne confond pas le gras avec deux italiques", () => {
    expect(parseInline("**tout gras**")).toEqual([{ kind: "strong", value: "tout gras" }]);
  });

  it("laisse passer le texte nu tel quel", () => {
    expect(parseInline("Rien à signaler.")).toEqual([
      { kind: "text", value: "Rien à signaler." },
    ]);
  });
});

describe("parseScript", () => {
  it("découpe titres, paragraphes et listes", () => {
    const blocks = parseScript(
      [
        "## L'accroche",
        "",
        "Premier paragraphe",
        "sur deux lignes.",
        "",
        "- point un",
        "- point deux",
        "",
        "1. étape une",
        "2. étape deux",
      ].join("\n"),
    );

    expect(blocks.map((block) => block.kind)).toEqual([
      "heading",
      "paragraph",
      "list",
      "list",
    ]);
    expect(blocks[1]).toEqual({
      kind: "paragraph",
      content: [{ kind: "text", value: "Premier paragraphe sur deux lignes." }],
    });
    expect(blocks[2]).toMatchObject({ ordered: false });
    expect(blocks[3]).toMatchObject({ ordered: true });
  });

  it("rétrograde un h1 en h2 : le titre de la leçon vit en base", () => {
    const blocks = parseScript("# Titre indu\n\n### Sous-partie");
    expect(blocks[0]).toMatchObject({ kind: "heading", level: 2 });
    expect(blocks[1]).toMatchObject({ kind: "heading", level: 3 });
  });

  it("rassemble une citation multiligne et reconnaît le filet", () => {
    const blocks = parseScript("> Première ligne\n> seconde ligne\n\n---");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.kind).toBe("quote");
    expect(blocks[1]?.kind).toBe("hr");
  });

  it("rend une structure vide pour un script vide", () => {
    expect(parseScript("")).toEqual([]);
    expect(parseScript("\n\n")).toEqual([]);
  });
});
