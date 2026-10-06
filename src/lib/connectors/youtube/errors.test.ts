import { describe, expect, it } from "vitest";

import { explainYouTubeError } from "./errors";

describe("explainYouTubeError", () => {
  it("ne propose pas de rebrancher sur un quota épuisé — il repart seul", () => {
    const diagnosis = explainYouTubeError(
      "The request cannot be completed because you have exceeded your quota. (quotaExceeded)",
    );
    expect(diagnosis.reconnect).toBe(false);
    expect(diagnosis.message).toContain("quota YouTube du jour");
  });

  it("donne le lien d'activation quand l'API n'est pas activée sur le projet", () => {
    const diagnosis = explainYouTubeError(
      "YouTube Data API v3 has not been used in project 285345048097 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/youtube.googleapis.com/overview?project=285345048097 then retry. (accessNotConfigured)",
    );
    expect(diagnosis.message).toContain("n'est pas activée");
    expect(diagnosis.message).toContain(
      "https://console.cloud.google.com/apis/library/youtube.googleapis.com?project=285345048097",
    );
  });

  it("dit qu'une vidéo sans commentaires n'est pas une panne", () => {
    const diagnosis = explainYouTubeError("Comments disabled (commentsDisabled)");
    expect(diagnosis.reconnect).toBe(false);
    expect(diagnosis.message).toContain("pas une erreur");
  });

  it("nomme les deux causes d'un invalid_grant, dont le mode Testing", () => {
    const diagnosis = explainYouTubeError("invalid_grant: Token has been expired or revoked.");
    expect(diagnosis.reconnect).toBe(true);
    expect(diagnosis.message).toContain("sept jours");
  });

  it("désigne la portée manquante sur un refus de permissions", () => {
    const diagnosis = explainYouTubeError(
      "Request had insufficient authentication scopes. (insufficientPermissions)",
    );
    expect(diagnosis.reconnect).toBe(true);
    expect(diagnosis.message).toContain("youtube.force-ssl");
  });

  it("rend le message d'origine quand il ne reconnaît rien", () => {
    expect(explainYouTubeError("Backend error 503").message).toBe("Backend error 503");
  });
});
