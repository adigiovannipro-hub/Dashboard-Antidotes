import { describe, expect, it } from "vitest";

import {
  tiktokPayload,
  tiktokProfile,
  tiktokVideosPage,
  xProfile,
  xTweetsPage,
} from "./mapping";

describe("tiktokPayload", () => {
  it("rend les données quand TikTok répond « ok »", () => {
    expect(
      tiktokPayload({ data: { user: { open_id: "a" } }, error: { code: "ok", message: "" } }),
    ).toEqual({ user: { open_id: "a" } });
  });

  it("descend une enveloppe de plus", () => {
    expect(
      tiktokPayload({ data: { data: { videos: [] }, error: { code: "ok" } } }),
    ).toEqual({ videos: [] });
  });

  it("lève sur un refus plutôt que de lire une liste vide", () => {
    expect(() =>
      tiktokPayload({
        data: {},
        error: { code: "scope_not_authorized", message: "video.list missing" },
      }),
    ).toThrow("scope_not_authorized");
  });
});

describe("tiktokProfile", () => {
  it("lit l'identité et les compteurs", () => {
    const profile = tiktokProfile({
      data: {
        user: {
          open_id: "open-1",
          username: "andrea",
          display_name: "Andrea",
          avatar_url_100: "https://p.tiktok/a.jpg",
          follower_count: 12_400,
          video_count: 88,
        },
      },
      error: { code: "ok" },
    });
    expect(profile).toEqual({
      externalId: "open-1",
      username: "andrea",
      displayName: "Andrea",
      avatarUrl: "https://p.tiktok/a.jpg",
      biography: null,
      followers: 12_400,
      mediaCount: 88,
    });
  });

  it("rend null sans identifiant", () => {
    expect(tiktokProfile({ data: { user: {} }, error: { code: "ok" } })).toBeNull();
  });
});

describe("tiktokVideosPage", () => {
  it("range une vidéo avec ses vues comme vues vidéo, sans enregistrement", () => {
    const page = tiktokVideosPage({
      data: {
        videos: [
          {
            id: "v1",
            create_time: 1_790_000_000,
            video_description: "Coulisses",
            share_url: "https://www.tiktok.com/@andrea/video/v1",
            cover_image_url: "https://p.tiktok/c.jpg",
            view_count: 5_000,
            like_count: 300,
            comment_count: 12,
            share_count: 7,
          },
        ],
        cursor: 1_789_999_000_000,
        has_more: true,
      },
      error: { code: "ok" },
    });
    expect(page.hasMore).toBe(true);
    expect(page.cursor).toBe(1_789_999_000_000);
    expect(page.posts[0]).toMatchObject({
      externalId: "v1",
      publishedAt: new Date(1_790_000_000_000).toISOString(),
      caption: "Coulisses",
      mediaKind: "video",
      impressions: 5_000,
      videoViews: 5_000,
      likes: 300,
      comments: 12,
      shares: 7,
      saves: 0,
    });
  });

  it("écarte une vidéo sans date", () => {
    expect(
      tiktokVideosPage({ data: { videos: [{ id: "v" }], has_more: false }, error: { code: "ok" } })
        .posts,
    ).toEqual([]);
  });
});

describe("xProfile", () => {
  it("lit l'identité, les abonnés et l'avatar en grand format", () => {
    expect(
      xProfile({
        data: {
          id: "42",
          username: "andrea",
          name: "Andrea",
          profile_image_url: "https://pbs.twimg.com/a_normal.jpg",
          public_metrics: { followers_count: 980, tweet_count: 1_200 },
        },
      }),
    ).toEqual({
      externalId: "42",
      username: "andrea",
      displayName: "Andrea",
      avatarUrl: "https://pbs.twimg.com/a_400x400.jpg",
      biography: null,
      followers: 980,
      mediaCount: 1_200,
    });
  });

  it("lève sur un refus de X", () => {
    expect(() => xProfile({ title: "Forbidden", detail: "client-not-enrolled" })).toThrow(
      "client-not-enrolled",
    );
  });
});

describe("xTweetsPage", () => {
  it("compte reposts et citations comme partages, signets comme enregistrements", () => {
    const page = xTweetsPage(
      {
        data: [
          {
            id: "100",
            text: "Bonjour",
            created_at: "2026-09-30T10:00:00.000Z",
            attachments: { media_keys: ["7_1"] },
            public_metrics: {
              impression_count: 4_000,
              like_count: 50,
              reply_count: 4,
              retweet_count: 6,
              quote_count: 2,
              bookmark_count: 3,
            },
          },
        ],
        includes: {
          media: [
            {
              media_key: "7_1",
              type: "video",
              preview_image_url: "https://pbs.twimg.com/p.jpg",
              public_metrics: { view_count: 1_500 },
            },
          ],
        },
        meta: { next_token: "abc" },
      },
      "andrea",
    );
    expect(page.nextToken).toBe("abc");
    expect(page.posts[0]).toEqual({
      externalId: "100",
      publishedAt: "2026-09-30T10:00:00.000Z",
      caption: "Bonjour",
      permalink: "https://x.com/andrea/status/100",
      thumbnailUrl: "https://pbs.twimg.com/p.jpg",
      mediaKind: "video",
      impressions: 4_000,
      videoViews: 1_500,
      likes: 50,
      comments: 4,
      shares: 8,
      saves: 3,
    });
  });

  it("lit une page vide comme vide, sans lever", () => {
    expect(xTweetsPage({ meta: { result_count: 0 } }, "andrea").posts).toEqual([]);
  });
});
