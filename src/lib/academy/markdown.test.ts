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

describe("parseScript — tableaux", () => {
  it("sépare l'en-tête du corps et ignore la ligne de tirets", () => {
    const blocks = parseScript(
      ["| Métier | Prix |", "|---|---|", "| UGC | 220 € |", "| Influence | 180 € |"].join(
        "\n",
      ),
    );

    expect(blocks).toHaveLength(1);
    const table = blocks[0]!;
    expect(table.kind).toBe("table");
    if (table.kind !== "table") return;
    expect(table.head).toHaveLength(2);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[1]![0]![0]).toEqual({ kind: "text", value: "Influence" });
  });

  it("rend le gras et les liens dans une cellule", () => {
    const blocks = parseScript(["| Nom |", "|---|", "| **Léa** |"].join("\n"));
    const table = blocks[0]!;
    if (table.kind !== "table") throw new Error("bloc inattendu");
    expect(table.rows[0]![0]![0]).toEqual({ kind: "strong", value: "Léa" });
  });

  it("ferme le tableau à la ligne vide, sans avaler le paragraphe suivant", () => {
    const blocks = parseScript(
      ["| A |", "|---|", "| 1 |", "", "Un paragraphe après."].join("\n"),
    );
    expect(blocks.map((block) => block.kind)).toEqual(["table", "paragraph"]);
  });
});
