import { describe, expect, it } from "vitest";

import {
  compareBoardKeys,
  firstDirectionOf,
  parseBoardSort,
  serializeBoardSort,
  sortBoardRows,
  type BoardSortKey,
} from "./board-sort";

/* Les deux formes de rangée du board : une mensualité de devis et une facture
   Airwallex hors devis. Le tri ne connaît que la clé qu'elles exposent. */
const mensualite = (over: Partial<BoardSortKey> = {}): BoardSortKey => ({
  client: "Bondet",
  date: "2026-07-01",
  cents: 120_000,
  currency: "EUR",
  ...over,
});

const facture = (over: Partial<BoardSortKey> = {}): BoardSortKey => ({
  client: "Night Session",
  date: "2026-08-12",
  cents: 210_250,
  currency: "EUR",
  ...over,
});

describe("parseBoardSort", () => {
  it("lit le champ et le sens", () => {
    expect(parseBoardSort("montant-desc")).toEqual({
      field: "montant",
      direction: "desc",
    });
    expect(parseBoardSort("client-asc")).toEqual({ field: "client", direction: "asc" });
  });

  it("rend null sur tout ce qui n'est pas un tri connu", () => {
    for (const value of [null, undefined, "", "montant", "couleur-asc", "montant-haut"]) {
      expect(parseBoardSort(value)).toBeNull();
    }
  });

  it("fait l'aller-retour avec serializeBoardSort", () => {
    const sort = { field: "periode", direction: "desc" } as const;
    expect(parseBoardSort(serializeBoardSort(sort))).toEqual(sort);
  });
});

describe("firstDirectionOf", () => {
  it("ouvre un montant par le plus gros et un nom par le début", () => {
    expect(firstDirectionOf("montant")).toBe("desc");
    expect(firstDirectionOf("client")).toBe("asc");
    expect(firstDirectionOf("periode")).toBe("asc");
  });
});

describe("compareBoardKeys", () => {
  it("range les clients sans tenir compte de la casse ni des accents", () => {
    const a = mensualite({ client: "écran" });
    const b = facture({ client: "Ecran" });
    expect(compareBoardKeys(a, b, { field: "client", direction: "asc" })).toBe(0);
  });

  it("inverse l'ordre au sens descendant", () => {
    const a = mensualite({ client: "Alpha" });
    const b = facture({ client: "Zulu" });
    expect(
      compareBoardKeys(a, b, { field: "client", direction: "asc" }),
    ).toBeLessThan(0);
    expect(
      compareBoardKeys(a, b, { field: "client", direction: "desc" }),
    ).toBeGreaterThan(0);
  });

  it("pousse une date absente au bout de la file, jamais en tête", () => {
    const sansDate = facture({ date: "" });
    const datee = mensualite({ date: "2026-01-01" });
    expect(
      compareBoardKeys(datee, sansDate, { field: "periode", direction: "asc" }),
    ).toBeLessThan(0);
  });

  it("ne compare jamais deux devises entre elles — elles se rangent l'une après l'autre", () => {
    const euros = mensualite({ cents: 100, currency: "EUR" });
    const dollars = facture({ cents: 900_000, currency: "USD" });
    /* Le plus gros nombre est en dollars, et il reste derrière : sans taux de
       change, « plus grand » n'a aucun sens entre deux devises. */
    for (const direction of ["asc", "desc"] as const) {
      expect(
        compareBoardKeys(euros, dollars, { field: "montant", direction }),
      ).toBeLessThan(0);
    }
  });
});

describe("sortBoardRows", () => {
  const rows = [
    { id: "a", key: mensualite({ client: "Chasseurs", cents: 50_000, date: "2026-09-01" }) },
    { id: "b", key: facture({ client: "Bondet", cents: 210_250, date: "2026-07-12" }) },
    { id: "c", key: mensualite({ client: "Ardent", cents: 120_000, date: "2026-08-01" }) },
  ];
  const keyOf = (row: (typeof rows)[number]) => row.key;

  it("laisse l'ordre du groupe intact quand aucun tri n'est demandé", () => {
    expect(sortBoardRows(rows, keyOf, null).map((row) => row.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("trie par montant décroissant", () => {
    const sorted = sortBoardRows(rows, keyOf, { field: "montant", direction: "desc" });
    expect(sorted.map((row) => row.id)).toEqual(["b", "c", "a"]);
  });

  it("trie par client puis par période", () => {
    expect(
      sortBoardRows(rows, keyOf, { field: "client", direction: "asc" }).map(
        (row) => row.id,
      ),
    ).toEqual(["c", "b", "a"]);
    expect(
      sortBoardRows(rows, keyOf, { field: "periode", direction: "asc" }).map(
        (row) => row.id,
      ),
    ).toEqual(["b", "c", "a"]);
  });

  it("garde l'ordre du groupe entre deux lignes de même valeur", () => {
    const egales = [
      { id: "premier", key: mensualite({ cents: 1_000 }) },
      { id: "second", key: facture({ cents: 1_000 }) },
    ];
    const sorted = sortBoardRows(egales, (row) => row.key, {
      field: "montant",
      direction: "desc",
    });
    expect(sorted.map((row) => row.id)).toEqual(["premier", "second"]);
  });

  it("ne modifie pas la liste reçue", () => {
    const source = [...rows];
    sortBoardRows(source, keyOf, { field: "montant", direction: "asc" });
    expect(source.map((row) => row.id)).toEqual(["a", "b", "c"]);
  });
});
