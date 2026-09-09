import { describe, expect, it } from "vitest";

import { moveEntry, orderEntries, parseRailOrder } from "./navigation-order";

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
