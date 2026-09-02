import { describe, expect, it } from "vitest";

import { explainLinkedinError } from "./errors";

describe("explainLinkedinError", () => {
  it("traduit le refus des portées d'organisation en geste à faire", () => {
    const message = explainLinkedinError(
      "Forbidden. You don't have permission to access organization ACLs. Ensure you have the r_organization_admin scope.",
    );
    expect(message).toContain("linkedin-pages");
    // Le brut reste : la traduction guide, l'original prouve.
    expect(message).toContain("r_organization_admin");
  });

  it("distingue le plafond d'appels, le seul cas où rebrancher ne sert à rien", () => {
    expect(explainLinkedinError("429 rate limit exceeded")).toContain(
      "rien à rebrancher",
    );
  });

  it("désigne le connecteur, pas la connexion, sur une demande mal formée", () => {
    expect(
      explainLinkedinError("Bad request. Please check the time intervals parameter"),
    ).toContain("défaut du connecteur");
  });

  it("rend le message brut quand il ne reconnaît rien", () => {
    expect(explainLinkedinError("Erreur inconnue")).toBe("Erreur inconnue");
  });
});
