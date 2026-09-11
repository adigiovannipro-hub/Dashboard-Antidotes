import { describe, expect, it } from "vitest";

import { explainMetaError, isTransientMeta, metaErrorCode } from "./errors";

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

  it("traduit le renoncement de Meta sur une boîte trop lourde", () => {
    // Le refus qui laissait les DM Instagram à zéro : Meta n'assemblait pas la
    // réponse dans son délai, et la phrase brute se lisait comme une panne.
    const diagnosis = explainMetaError(
      "Request aborted: long polling terminated due to timeout",
    );
    expect(diagnosis.message).toContain("tranches plus petites");
    expect(diagnosis.reconnect).toBe(false);
  });

  it("ne confond pas (#10) avec l'incident passager (#1)", () => {
    // `"(#10)".includes("(#1)")` est vrai : la reconnaissance se fait sur le
    // numéro extrait, jamais en sous-chaîne.
    const diagnosis = explainMetaError(
      "(#10) This endpoint requires the 'pages_read_user_content' permission.",
    );
    expect(diagnosis.message).toContain("pages_read_user_content");
    expect(diagnosis.reconnect).toBe(true);
  });

  it("rend le message d'origine quand il ne reconnaît rien", () => {
    // Le masquer coûterait la seule piste de diagnostic.
    const diagnosis = explainMetaError("Quelque chose d'inédit");
    expect(diagnosis.message).toBe("Quelque chose d'inédit");
    expect(diagnosis.reconnect).toBe(false);
  });
});

describe("metaErrorCode", () => {
  it("extrait le numéro d'un refus Graph", () => {
    expect(metaErrorCode("(#10) This endpoint requires…")).toBe(10);
    expect(metaErrorCode("(#-1) An unknown error occurred")).toBe(-1);
  });

  it("rend null quand le message ne porte pas de numéro", () => {
    expect(metaErrorCode("Session has expired")).toBeNull();
  });
});

describe("isTransientMeta", () => {
  it("reconnaît le renoncement de Meta sur une réponse trop lourde", () => {
    expect(
      isTransientMeta(new Error("long polling terminated due to timeout")),
    ).toBe(true);
    expect(isTransientMeta(new Error("504 Gateway Time-out"))).toBe(true);
    expect(
      isTransientMeta(new Error("(#2) Service temporarily unavailable")),
    ).toBe(true);
  });

  it("croit un transport qui a déjà tranché", () => {
    // `MetaError` porte `retryable` — lu sans importer le transport, qui est
    // `server-only`.
    const error = Object.assign(new Error("Bad Gateway"), { retryable: true });
    expect(isTransientMeta(error)).toBe(true);
  });

  it("ne prend pas un refus de portée pour un incident", () => {
    // La faute qui ferait redescendre l'escalier quinze fois pour le même refus.
    expect(
      isTransientMeta(
        new Error("(#10) This endpoint requires the 'pages_read_user_content' permission."),
      ),
    ).toBe(false);
    expect(isTransientMeta(new Error("(#17) User request limit reached"))).toBe(
      false,
    );
  });

  it("rend faux sur ce qui n'est pas une erreur", () => {
    expect(isTransientMeta("timeout")).toBe(false);
    expect(isTransientMeta(null)).toBe(false);
  });
});
