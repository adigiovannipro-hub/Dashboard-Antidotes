import { describe, expect, it } from "vitest";

import { draftStateOf, isUnauditedRefusal, tiktokErrorText } from "./tiktok-status";

describe("draftStateOf", () => {
  it("un brouillon dans la boîte attend le geste du client", () => {
    expect(draftStateOf({ status: "SEND_TO_USER_INBOX" })).toEqual({ state: "waiting" });
    expect(draftStateOf({ status: "PROCESSING_UPLOAD" })).toEqual({ state: "waiting" });
    expect(draftStateOf(undefined)).toEqual({ state: "waiting" });
  });

  it("publié : garde l'identifiant quand il est sûr", () => {
    expect(
      draftStateOf({ status: "PUBLISH_COMPLETE", publicaly_available_post_id: ["7431234567890123456"] }),
    ).toEqual({ state: "published", postId: "7431234567890123456" });
    expect(draftStateOf({ status: "PUBLISH_COMPLETE", publicaly_available_post_id: [] })).toEqual({
      state: "published",
      postId: null,
    });
  });

  it("un identifiant relu en nombre au-delà de 2^53 ne fait pas de lien", () => {
    expect(
      draftStateOf({ status: "PUBLISH_COMPLETE", publicaly_available_post_id: [7431234567890123456] }),
    ).toEqual({ state: "published", postId: null });
  });

  it("un échec dit sa cause en français", () => {
    expect(draftStateOf({ status: "FAILED", fail_reason: "publish_cancelled" })).toEqual({
      state: "failed",
      reason: "brouillon supprimé dans l'application TikTok",
    });
    expect(draftStateOf({ status: "FAILED", fail_reason: "inconnu" })).toEqual({
      state: "failed",
      reason: "TikTok a refusé le brouillon (inconnu)",
    });
  });
});

describe("tiktokErrorText", () => {
  it("traduit les refus connus avec le geste à faire", () => {
    expect(tiktokErrorText("scope_not_authorized", "x")).toContain("video.upload");
  });

  it("garde le code et le message d'un refus inconnu", () => {
    expect(tiktokErrorText("invalid_params", "video_size")).toBe("TikTok invalid_params — video_size");
  });
});

describe("isUnauditedRefusal", () => {
  it("ne reconnaît que le refus d'une app non auditée", () => {
    expect(isUnauditedRefusal("unaudited_client_can_only_post_to_private_accounts")).toBe(true);
    expect(isUnauditedRefusal("scope_not_authorized")).toBe(false);
    expect(isUnauditedRefusal(null)).toBe(false);
  });
});
