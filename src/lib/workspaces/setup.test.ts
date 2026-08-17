import { describe, expect, it } from "vitest";

import { planYearLanes, planYearMonths } from "./setup";

describe("planYearMonths", () => {
  it("rend les douze mois de l'année dans l'ordre", () => {
    const months = planYearMonths(2026);

    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ label: "JANVIER", month: "2026-01-01", position: 0 });
    expect(months[11]).toEqual({ label: "DÉCEMBRE", month: "2026-12-01", position: 11 });
  });

  it("compose la date sans passer par un fuseau", () => {
    // Le piège : un `Date` construit en heure locale puis sérialisé rendrait
    // « 2025-12-31 » pour janvier à Paris, et tout le tableau glisserait.
    for (const month of planYearMonths(2026)) {
      expect(month.month).toMatch(/^2026-\d{2}-01$/);
    }
  });

  it("garde les deux chiffres du mois", () => {
    expect(planYearMonths(2026)[8]!.month).toBe("2026-09-01");
  });
});

describe("planYearLanes", () => {
  const months = planYearMonths(2026);

  it("pose un couloir par réseau et par mois", () => {
    const lanes = planYearLanes({ months, networks: ["Instagram", "LinkedIn"] });
    expect(lanes).toHaveLength(24);
  });

  it("garde le nom déclaré, pas le libellé de l'enum", () => {
    // Le client qui a écrit « Insta » doit retrouver « Insta » dans son tableau.
    const lanes = planYearLanes({ months, networks: ["Insta"] });
    expect(lanes[0]!.name).toBe("Insta");
  });

  it("range un réseau connu sous sa plateforme", () => {
    const lanes = planYearLanes({ months, networks: ["Instagram", "TikTok"] });
    expect(lanes[0]!.platform).toBe("instagram");
    expect(lanes[1]!.platform).toBe("tiktok");
  });

  it("range sous « autre » ce que l'enum du planning ne connaît pas", () => {
    // Threads est un réseau légitime aux livrables sans valeur dans l'enum.
    const lanes = planYearLanes({ months, networks: ["Threads"] });
    expect(lanes[0]!.platform).toBe("other");
    expect(lanes[0]!.name).toBe("Threads");
  });

  it("respecte l'ordre de saisie des réseaux dans chaque mois", () => {
    const lanes = planYearLanes({ months, networks: ["LinkedIn", "Instagram"] });
    const janvier = lanes.filter((lane) => lane.monthPosition === 0);
    expect(janvier.map((lane) => lane.name)).toEqual(["LinkedIn", "Instagram"]);
    expect(janvier.map((lane) => lane.position)).toEqual([0, 1]);
  });

  it("ignore les noms vides", () => {
    expect(planYearLanes({ months, networks: ["  ", ""] })).toEqual([]);
  });

  it("rend les mois quand même sans aucun réseau", () => {
    // Un tableau à douze mois vides se remplit ; un tableau sans mois ne
    // s'ouvre même pas.
    expect(planYearLanes({ months, networks: [] })).toEqual([]);
    expect(months).toHaveLength(12);
  });
});
