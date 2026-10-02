import { describe, expect, it } from "vitest";

import { explainTiktokAdsError } from "./errors";

describe("explainTiktokAdsError", () => {
  it("traduit le refus de forme vu sur pièce", () => {
    const message = "TikTok 40002 max time span is 30 days when use stat_time_day";
    expect(explainTiktokAdsError(message)).toBe(
      `TikTok a refusé la forme de la demande. C'est un défaut du connecteur, pas de la connexion — à signaler. (${message})`,
    );
  });

  it("dit de rebrancher sur un jeton révoqué", () => {
    expect(
      explainTiktokAdsError("TikTok 40105 Access token is incorrect or has been revoked."),
    ).toMatch(/^L'accès TikTok Ads a expiré ou a été révoqué/);
  });

  it("ne propose pas de rebrancher sur un plafond d'appels", () => {
    expect(explainTiktokAdsError("TikTok 51021 Too many requests")).toMatch(
      /^Le plafond d'appels TikTok est atteint/,
    );
  });

  it("rend le message tel quel quand il est inconnu", () => {
    expect(explainTiktokAdsError("Panne inattendue")).toBe("Panne inattendue");
  });
});
