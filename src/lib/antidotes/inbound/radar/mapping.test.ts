import { describe, expect, it } from "vitest";

import { mapInstagramMedia } from "./instagram";
import { mapApifyInstagramItem } from "./instagram-apify";
import { mapLinkedinPost } from "./linkedin";
import { mapTiktokPost } from "./tiktok";
import { asIso, normalizeHandle } from "./types";
import { mapXPost } from "./x";
import { mapYoutubeVideo } from "./youtube";

describe("mapLinkedinPost", () => {
  it("lit texte, url, date et réactions ; ignore un post sans texte", () => {
    const post = mapLinkedinPost(
      {
        text: "Le tunnel décide de tout.",
        url: "https://www.linkedin.com/posts/sandro_abc",
        posted_at: { timestamp: 1757260800000 },
        stats: { total_reactions: 120, comments: 14, reposts: 3 },
        author: { username: "sandro" },
      },
      "x",
    );
    expect(post).toMatchObject({
      url: "https://www.linkedin.com/posts/sandro_abc",
      content: "Le tunnel décide de tout.",
      published_at: "2025-09-07T16:00:00.000Z",
      metrics: { likes: 120, comments: 14, shares: 3 },
      author_handle: "sandro",
    });
    expect(mapLinkedinPost({ url: "https://x", text: "" }, "x")).toBeNull();
  });
});

describe("mapXPost", () => {
  it("écarte les retweets et garde les vues et les abonnés", () => {
    expect(mapXPost({ text: "rt", url: "https://x.com/a/1", isRetweet: true }, "a")).toBeNull();
    expect(
      mapXPost(
        { text: "Un tweet", url: "https://x.com/a/2", createdAt: "Tue Sep 09 10:00:00 +0000 2025", likeCount: 5, replyCount: 1, retweetCount: 2, viewCount: 900, author: { userName: "a", followers: 4000 } },
        "a",
      ),
    ).toMatchObject({ metrics: { likes: 5, comments: 1, shares: 2, views: 900, followers_at_collect: 4000 }, published_at: "2025-09-09T10:00:00.000Z" });
  });
});

describe("mapTiktokPost / mapYoutubeVideo / mapInstagramMedia", () => {
  it("lit les vidéos TikTok, y compris sans texte", () => {
    expect(mapTiktokPost({ webVideoUrl: "https://www.tiktok.com/@a/video/1", diggCount: 10, playCount: 1000, authorMeta: { fans: 500 } }, "a")).toMatchObject({
      content: "(vidéo sans texte)",
      metrics: { likes: 10, views: 1000, followers_at_collect: 500 },
    });
  });

  it("compose titre et description d'une vidéo YouTube et convertit les chaînes en nombres", () => {
    expect(
      mapYoutubeVideo(
        { id: "v1", snippet: { title: "Titre", description: "Desc", publishedAt: "2025-09-01T08:00:00Z", channelTitle: "Chaîne" }, statistics: { viewCount: "1200", likeCount: "80", commentCount: "9" } },
        "handle",
      ),
    ).toMatchObject({ url: "https://www.youtube.com/watch?v=v1", content: "Titre\n\nDesc", metrics: { views: 1200, likes: 80, comments: 9 }, author_handle: "Chaîne" });
  });

  it("nomme un Reel sans légende et porte les abonnés relevés", () => {
    expect(
      mapInstagramMedia({ permalink: "https://www.instagram.com/reel/x/", media_product_type: "REELS", like_count: 40, comments_count: 3, timestamp: "2025-09-02T10:00:00+0000" }, "marque", 12000),
    ).toMatchObject({ content: "(Reel sans légende)", metrics: { likes: 40, comments: 3, followers_at_collect: 12000 }, published_at: "2025-09-02T10:00:00.000Z" });
  });
});

describe("normalizeHandle / asIso", () => {
  it("retire l'arobase et lit une URL de profil", () => {
    expect(normalizeHandle("@sandro")).toBe("sandro");
    expect(normalizeHandle("https://www.linkedin.com/in/sandro-dg/")).toBe("sandro-dg");
    expect(normalizeHandle("https://www.youtube.com/@chaine")).toBe("chaine");
    expect(normalizeHandle("https://www.tiktok.com/@marque?lang=fr")).toBe("marque");
  });

  it("date un timestamp en secondes comme en millisecondes", () => {
    expect(asIso(1757260800)).toBe("2025-09-07T16:00:00.000Z");
    expect(asIso("pas une date")).toBeNull();
  });
});


describe("mapApifyInstagramItem", () => {
  it("lit un reel : vues, vidéo, nature du média", () => {
    const post = mapApifyInstagramItem(
      {
        type: "Video",
        url: "https://www.instagram.com/reel/abc/",
        caption: "  Coulisses d'un shooting.  ",
        timestamp: "2026-09-04T08:00:00.000Z",
        likesCount: 4200,
        commentsCount: 138,
        videoPlayCount: 48000,
        videoUrl: "https://cdn.invalid/reel.mp4",
        ownerUsername: "agence.lumen",
      },
      "agence.lumen",
      31000,
    );
    expect(post).toEqual({
      url: "https://www.instagram.com/reel/abc/",
      content: "Coulisses d'un shooting.",
      published_at: "2026-09-04T08:00:00.000Z",
      metrics: { likes: 4200, comments: 138, views: 48000, followers_at_collect: 31000 },
      author_handle: "agence.lumen",
      media_kind: "video",
      media_url: "https://cdn.invalid/reel.mp4",
    });
  });

  it("nomme un média sans légende plutôt que de rendre une ligne vide", () => {
    const post = mapApifyInstagramItem({ type: "Sidecar", shortCode: "xyz", caption: null }, "lumen", null);
    expect(post?.content).toBe("(Carrousel sans légende)");
    expect(post?.url).toBe("https://www.instagram.com/p/xyz/");
    expect(post?.media_kind).toBe("carousel");
    expect(post?.media_url).toBeNull();
  });

  it("écarte une entrée sans identifiant : rien à rattacher", () => {
    expect(mapApifyInstagramItem({ type: "Image", caption: "sans url" }, "lumen", null)).toBeNull();
  });

  it("ne pose pas de vues quand le réseau n'en rend aucune", () => {
    const post = mapApifyInstagramItem({ type: "Image", shortCode: "s", likesCount: 12 }, "lumen", null);
    expect(post?.metrics.views).toBeUndefined();
  });
});
