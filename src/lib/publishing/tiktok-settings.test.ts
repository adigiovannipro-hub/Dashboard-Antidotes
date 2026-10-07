import { describe, expect, it } from "vitest";

import {
  creatorOf,
  directPostInfo,
  parseTiktokSettings,
  tiktokSettingsIssue,
  type TiktokPostSettings,
} from "./tiktok-settings";

const settings = (over: Partial<TiktokPostSettings> = {}): TiktokPostSettings => ({
  privacy: "PUBLIC_TO_EVERYONE",
  allowComment: true,
  allowDuet: false,
  allowStitch: false,
  yourBrand: false,
  brandedContent: false,
  consentedAt: "2026-10-07T10:00:00Z",
  ...over,
});

describe("parseTiktokSettings", () => {
  it("relit des réglages complets", () => {
    expect(parseTiktokSettings(settings())).toEqual(settings());
  });

  it("une forme incomplète vaut « pas de réglages »", () => {
    expect(parseTiktokSettings(null)).toBeNull();
    expect(parseTiktokSettings({ privacy: "PUBLIC_TO_EVERYONE" })).toBeNull();
    expect(parseTiktokSettings({ privacy: "PARTOUT", consentedAt: "x" })).toBeNull();
  });

  it("une case absente est décochée, jamais cochée", () => {
    expect(
      parseTiktokSettings({ privacy: "SELF_ONLY", consentedAt: "x", allowComment: "oui" }),
    ).toMatchObject({ allowComment: false, allowDuet: false, yourBrand: false });
  });
});

describe("tiktokSettingsIssue", () => {
  it("refuse un contenu de marque privé, comme TikTok", () => {
    expect(tiktokSettingsIssue({ privacy: "SELF_ONLY", brandedContent: true })).not.toBeNull();
    expect(tiktokSettingsIssue({ privacy: "PUBLIC_TO_EVERYONE", brandedContent: true })).toBeNull();
    expect(tiktokSettingsIssue({ privacy: "SELF_ONLY", brandedContent: false })).toBeNull();
  });
});

describe("creatorOf", () => {
  it("lit le compte et ne garde que les options de confidentialité connues", () => {
    expect(
      creatorOf({
        creator_nickname: "Chasseurs de Graines",
        creator_username: "chasseursdegraines",
        creator_avatar_url: "https://p16.tiktokcdn.com/a.jpg",
        privacy_level_options: ["PUBLIC_TO_EVERYONE", "SELF_ONLY", "NOUVELLE_OPTION"],
        comment_disabled: true,
        duet_disabled: false,
        stitch_disabled: false,
        max_video_post_duration_sec: 600,
      }),
    ).toEqual({
      nickname: "Chasseurs de Graines",
      username: "chasseursdegraines",
      avatarUrl: "https://p16.tiktokcdn.com/a.jpg",
      privacyOptions: ["PUBLIC_TO_EVERYONE", "SELF_ONLY"],
      commentDisabled: true,
      duetDisabled: false,
      stitchDisabled: false,
      maxDurationSec: 600,
    });
  });
});

describe("directPostInfo", () => {
  it("un réglage coupé par le compte l'emporte", () => {
    const creator = creatorOf({ comment_disabled: true });
    expect(directPostInfo(settings({ allowComment: true }), creator, "Légende")).toEqual({
      title: "Légende",
      privacy_level: "PUBLIC_TO_EVERYONE",
      disable_comment: true,
      disable_duet: true,
      disable_stitch: true,
      brand_organic_toggle: false,
      brand_content_toggle: false,
    });
  });
});
