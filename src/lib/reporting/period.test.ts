import { describe, expect, it } from "vitest";

import {
  lastCompleteMonth,
  monthBounds,
  monthKey,
  monthLabel,
  monthOptions,
  parseRange,
  parseMonth,
  presetOf,
  presetRange,
  previousMonth,
} from "./period";

const aout = new Date("2026-08-14T09:00:00Z");

describe("lastCompleteMonth", () => {
  it("rend juillet quand on est en août", () => {
    expect(lastCompleteMonth(aout)).toBe("2026-07");
  });

  it("repasse sur l'année précédente en janvier", () => {
    expect(lastCompleteMonth(new Date("2027-01-03T00:00:00Z"))).toBe("2026-12");
  });

  it("rend le mois précédent même le premier jour du mois", () => {
    expect(lastCompleteMonth(new Date("2026-09-01T00:30:00Z"))).toBe("2026-08");
  });
});

describe("monthLabel", () => {
  it("écrit le mois en français", () => {
    expect(monthLabel("2026-07")).toBe("juillet 2026");
    expect(monthLabel("2026-08")).toBe("août 2026");
    expect(monthLabel("2026-12")).toBe("décembre 2026");
  });
});

describe("previousMonth", () => {
  it("recule d'un mois", () => {
    expect(previousMonth("2026-07")).toBe("2026-06");
  });

  it("recule d'une année en janvier", () => {
    expect(previousMonth("2026-01")).toBe("2025-12");
  });
});

describe("monthOptions", () => {
  it("part du dernier mois révolu et remonte", () => {
    expect(monthOptions(aout, 3)).toEqual(["2026-07", "2026-06", "2026-05"]);
  });

  it("n'inclut jamais le mois en cours", () => {
    expect(monthOptions(aout, 12)).not.toContain("2026-08");
  });
});

describe("parseMonth", () => {
  it("accepte un mois valide", () => {
    expect(parseMonth("2026-07", aout)).toBe("2026-07");
  });

  it("refuse une forme invalide", () => {
    expect(parseMonth("2026-13", aout)).toBeNull();
    expect(parseMonth("juillet", aout)).toBeNull();
    expect(parseMonth(undefined, aout)).toBeNull();
  });

  it("refuse un mois futur", () => {
    expect(parseMonth("2026-09", aout)).toBeNull();
  });

  it("accepte le mois en cours, qu'un lien partagé peut porter", () => {
    expect(parseMonth("2026-08", aout)).toBe("2026-08");
  });
});

describe("monthBounds", () => {
  it("borne un mois de 31 jours", () => {
    expect(monthBounds("2026-07")).toEqual({ from: "2026-07-01", to: "2026-07-31" });
  });

  it("borne février d'une année bissextile", () => {
    expect(monthBounds("2024-02")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
  });
});

describe("monthKey", () => {
  it("complète le mois à deux chiffres", () => {
    expect(monthKey(new Date("2026-03-09T00:00:00Z"))).toBe("2026-03");
  });
});

describe("presetRange", () => {
  it("« le mois dernier » borne juillet quand on est en août", () => {
    expect(presetRange("mois-dernier", aout)).toEqual({
      from: "2026-07-01",
      to: "2026-07-31",
    });
  });

  it("les 30 derniers jours s'arrêtent hier, pas aujourd'hui", () => {
    expect(presetRange("30-jours", aout)).toEqual({
      from: "2026-07-15",
      to: "2026-08-13",
    });
  });

  it("« personnalisé » n'a pas de bornes", () => {
    expect(presetRange("personnalise", aout)).toBeNull();
  });
});

describe("presetOf", () => {
  it("reconnaît une plage qui tombe sur un préréglage", () => {
    expect(presetOf({ from: "2026-07-01", to: "2026-07-31" }, aout)).toBe(
      "mois-dernier",
    );
  });

  it("rend « personnalisé » pour une plage quelconque", () => {
    expect(presetOf({ from: "2026-07-03", to: "2026-07-19" }, aout)).toBe(
      "personnalise",
    );
  });
});

describe("parseRange", () => {
  it("accepte deux dates ISO", () => {
    expect(parseRange("2026-07-01", "2026-07-31")).toEqual({
      from: "2026-07-01",
      to: "2026-07-31",
    });
  });

  it("remet une plage à l'envers dans l'ordre", () => {
    expect(parseRange("2026-07-31", "2026-07-01")).toEqual({
      from: "2026-07-01",
      to: "2026-07-31",
    });
  });

  it("refuse une borne manquante ou mal formée", () => {
    expect(parseRange("2026-07-01", undefined)).toBeNull();
    expect(parseRange("01/07/2026", "2026-07-31")).toBeNull();
  });
});
