import { describe, expect, it } from "vitest";

import { explainGaError } from "./errors";

describe("explainGaError", () => {
  it("dit de brancher le compte quand Composio n'en connaît aucun", () => {
    expect(
      explainGaError("Could not find a connection with app='google_analytics'"),
    ).toContain("Aucun compte Google Analytics n'est connecté");
  });

  it("dit de partager la propriété sur un refus de permission", () => {
    expect(
      explainGaError("User does not have sufficient permissions for this property."),
    ).toContain("n'a pas accès à cette propriété");
  });

  it("ne propose pas de rebrancher quand le quota est épuisé", () => {
    const explained = explainGaError("RESOURCE_EXHAUSTED: Exhausted property tokens");
    expect(explained).toContain("quota");
    expect(explained).not.toContain("Reconnecter");
  });

  it("laisse passer tel quel un message qu'elle ne reconnaît pas", () => {
    expect(explainGaError("boom")).toBe("boom");
  });

  it("garde le message brut entre parenthèses — la traduction guide, l'original prouve", () => {
    expect(explainGaError("PERMISSION_DENIED: property 428494328")).toContain(
      "(PERMISSION_DENIED: property 428494328)",
    );
  });
});
