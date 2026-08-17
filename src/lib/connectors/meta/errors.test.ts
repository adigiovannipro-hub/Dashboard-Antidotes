import { describe, expect, it } from "vitest";

import { explainMetaError } from "./errors";

describe("explainMetaError", () => {
  it("renvoie un jeton sans pages_read_user_content vers Connexions", () => {
    // Le message vécu au premier sync réel, recopié tel quel. En accès
    // standard la permission fonctionne pour les comptes à rôle dans l'app :
    // le refus signifie que le jeton en base précède son ajout aux portées.
    const raw =
      "(#10) This endpoint requires the 'pages_read_user_content' permission or the 'Page Public Content Access' feature.";
    const diagnosis = explainMetaError(raw);
    expect(diagnosis.message).toContain("pages_read_user_content");
    expect(diagnosis.message).toContain("Rebrancher");
    expect(diagnosis.message).not.toContain("App Review");
    expect(diagnosis.reconnect).toBe(true);
  });

  it("distingue une portée absente de la console d'un jeton à refaire", () => {
    // « Invalid Scopes » se produit **avant** tout branchement : la portée
    // n'est pas ajoutée à l'app dans la console Meta, rebrancher rejouerait
    // le même refus.
    const diagnosis = explainMetaError(
      "Invalid Scopes: pages_read_user_content. This message is only shown to developers.",
    );
    expect(diagnosis.reconnect).toBe(false);
    expect(diagnosis.message).toContain("console Meta");
  });

  it("reconnaît un jeton expiré", () => {
    const diagnosis = explainMetaError("Error validating access token: Session has expired");
    expect(diagnosis.message).toContain("jeton d'accès Meta");
    expect(diagnosis.reconnect).toBe(true);
  });

  it("ne propose pas de rebrancher sur un plafond d'appels", () => {
    // Rebrancher n'y changerait rien : le quota se recharge tout seul.
    const diagnosis = explainMetaError("(#4) Application request limit reached");
    expect(diagnosis.reconnect).toBe(false);
    expect(diagnosis.message).toContain("prochain passage");
  });

  it("rend le message d'origine quand il ne reconnaît rien", () => {
    // Le masquer coûterait la seule piste de diagnostic.
    const diagnosis = explainMetaError("Quelque chose d'inédit");
    expect(diagnosis.message).toBe("Quelque chose d'inédit");
    expect(diagnosis.reconnect).toBe(false);
  });
});
