import { describe, expect, it } from "vitest";

import { mergeRailOrder, moveEntry, orderEntries, parseRailOrder, reorderHrefs } from "./navigation-order";

const entries = [
  { href: "/espace/bondet" },
  { href: "/espace/anmf" },
  { href: "/espace/i-way" },
];

describe("orderEntries", () => {
  it("range selon la liste mémorisée", () => {
    expect(orderEntries(entries, ["/espace/i-way", "/espace/bondet", "/espace/anmf"]).map((e) => e.href)).toEqual([
      "/espace/i-way",
      "/espace/bondet",
      "/espace/anmf",
    ]);
  });

  it("garde l'ordre par défaut sans liste", () => {
    expect(orderEntries(entries, undefined).map((e) => e.href)).toEqual(entries.map((e) => e.href));
    expect(orderEntries(entries, []).map((e) => e.href)).toEqual(entries.map((e) => e.href));
  });

  it("place une entrée inconnue après celles qu'on a rangées, sans la perdre", () => {
    expect(orderEntries(entries, ["/espace/anmf", "/espace/disparu"]).map((e) => e.href)).toEqual([
      "/espace/anmf",
      "/espace/bondet",
      "/espace/i-way",
    ]);
  });
});

describe("parseRailOrder", () => {
  it("ne garde que des listes de chaînes", () => {
    expect(parseRailOrder({ clients: ["/a", 3, null], entreprise: "non", autre: ["/b"] })).toEqual({ clients: ["/a"] });
    expect(parseRailOrder(null)).toEqual({});
  });
});

describe("moveEntry", () => {
  it("déplace vers l'avant et vers l'arrière", () => {
    expect(moveEntry(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveEntry(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("rend une copie intacte sur un geste sans effet", () => {
    expect(moveEntry(["a", "b"], 1, 1)).toEqual(["a", "b"]);
    expect(moveEntry(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });
});

describe("reorderHrefs", () => {
  const hrefs = ["/espace/bondet", "/espace/anmf", "/espace/i-way"];

  it("pose l'entrée saisie à la place de celle où on la lâche", () => {
    expect(reorderHrefs(hrefs, "/espace/anmf", "/espace/i-way")).toEqual([
      "/espace/bondet",
      "/espace/i-way",
      "/espace/anmf",
    ]);
    expect(reorderHrefs(hrefs, "/espace/i-way", "/espace/bondet")).toEqual([
      "/espace/i-way",
      "/espace/bondet",
      "/espace/anmf",
    ]);
  });

  it("rend une copie intacte sur un dépôt sur soi-même ou hors liste", () => {
    expect(reorderHrefs(hrefs, "/espace/anmf", "/espace/anmf")).toEqual(hrefs);
    expect(reorderHrefs(hrefs, "/espace/anmf", "/espace/inconnu")).toEqual(hrefs);
    expect(reorderHrefs(hrefs, "/espace/inconnu", "/espace/anmf")).toEqual(hrefs);
  });
});

describe("mergeRailOrder", () => {
  it("réécrit le groupe rangé et garde l'autre", () => {
    expect(mergeRailOrder({ entreprise: ["/academy", "/antidotes"] }, "clients", ["/espace/anmf", "/espace/bondet"])).toEqual(
      {
        clients: ["/espace/anmf", "/espace/bondet"],
        entreprise: ["/academy", "/antidotes"],
      },
    );
  });

  it("ne garde qu'une fois le même href", () => {
    expect(mergeRailOrder({}, "entreprise", ["/academy", "/academy", "/antidotes"])).toEqual({
      entreprise: ["/academy", "/antidotes"],
    });
  });
});
