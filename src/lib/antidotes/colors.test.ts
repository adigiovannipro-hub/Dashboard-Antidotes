import { describe, expect, it } from "vitest";

import {
  CAMPAIGN_RAMP,
  NO_CAMPAIGN_COLOR,
  PROSPECT_STATUS_TONES,
  campaignColor,
  initialsOf,
  scoreTone,
} from "./colors";
import { PROSPECT_STATUSES } from "./types";

const contact = (
  overrides: Partial<{ first_name: string | null; last_name: string | null; email: string | null }> = {},
) => ({ first_name: null, last_name: null, email: null, ...overrides });

describe("campaignColor", () => {
  it("rend le gris des axes sans campagne", () => {
    expect(campaignColor(null)).toBe(NO_CAMPAIGN_COLOR);
    expect(campaignColor("")).toBe(NO_CAMPAIGN_COLOR);
  });

  it("rend toujours la même teinte pour le même identifiant", () => {
    const id = "3f6a2c1e-9d4b-4a7e-8c2f-1b5d7e9a0c3d";
    expect(campaignColor(id)).toBe(campaignColor(id));
  });

  it("ne sort jamais de la rampe ordinale, et ne rend jamais un hex", () => {
    const ids = Array.from({ length: 50 }, (_, index) => `campagne-${index}`);
    for (const id of ids) {
      const color = campaignColor(id);
      expect(CAMPAIGN_RAMP).toContain(color);
      expect(color).toMatch(/^var\(--/);
    }
  });

  it("répartit des identifiants différents sur plusieurs teintes", () => {
    const ids = Array.from({ length: 50 }, (_, index) => `campagne-${index}`);
    const distinct = new Set(ids.map(campaignColor));
    expect(distinct.size).toBe(CAMPAIGN_RAMP.length);
  });
});

describe("scoreTone", () => {
  it("fonce avec le score, par paliers de 50, 70 et 90", () => {
    expect(scoreTone(0)).toBe(NO_CAMPAIGN_COLOR);
    expect(scoreTone(49)).toBe(NO_CAMPAIGN_COLOR);
    expect(scoreTone(50)).toBe("var(--ordinal-1)");
    expect(scoreTone(69)).toBe("var(--ordinal-1)");
    expect(scoreTone(70)).toBe("var(--ordinal-2)");
    expect(scoreTone(89)).toBe("var(--ordinal-2)");
    expect(scoreTone(90)).toBe("var(--ordinal-3)");
    expect(scoreTone(100)).toBe("var(--ordinal-3)");
  });

  it("retombe sur le gris pour un score qui n'en est pas un", () => {
    expect(scoreTone(Number.NaN)).toBe(NO_CAMPAIGN_COLOR);
  });
});

describe("initialsOf", () => {
  it("prend la première lettre du prénom et du nom", () => {
    expect(initialsOf(contact({ first_name: "Marie", last_name: "Dupont" }))).toBe("MD");
    expect(initialsOf(contact({ first_name: " élodie ", last_name: "martin" }))).toBe("ÉM");
  });

  it("prend les deux premières lettres d'un nom seul", () => {
    expect(initialsOf(contact({ first_name: "Alessandro" }))).toBe("AL");
    expect(initialsOf(contact({ last_name: "Bondet" }))).toBe("BO");
  });

  it("retombe sur l'adresse, puis sur rien", () => {
    expect(initialsOf(contact({ email: "j.durand@exemple.fr" }))).toBe("JD");
    expect(initialsOf(contact())).toBe("");
    expect(initialsOf(null)).toBe("");
  });
});

describe("PROSPECT_STATUS_TONES", () => {
  it("donne un ton à chaque statut du cycle", () => {
    for (const status of PROSPECT_STATUSES) {
      expect(PROSPECT_STATUS_TONES[status]).toBeTruthy();
    }
    expect(PROSPECT_STATUS_TONES.won).toBe("positive");
    expect(PROSPECT_STATUS_TONES.lost).toBe("danger");
    expect(PROSPECT_STATUS_TONES.replied).toBe("warning");
  });
});
