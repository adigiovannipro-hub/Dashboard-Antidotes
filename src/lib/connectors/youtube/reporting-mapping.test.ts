import { describe, expect, it } from "vitest";

import { channelStats, reportingVideos, uploadsPage } from "./reporting-mapping";

describe("channelStats", () => {
  const payload = {
    items: [
      {
        id: "UC-andrea",
        snippet: {
          title: "Andrea De Luca",
          customUrl: "@andrea4dl",
          thumbnails: {
            default: { url: "https://yt3/d.jpg" },
            high: { url: "https://yt3/h.jpg" },
          },
        },
        statistics: { subscriberCount: "37", videoCount: "34", hiddenSubscriberCount: false },
        contentDetails: { relatedPlaylists: { uploads: "UU-andrea" } },
      },
    ],
  };

  it("lit abonnés, vidéos, avatar et playlist des mises en ligne", () => {
    expect(channelStats(payload, "UC-andrea")).toEqual({
      id: "UC-andrea",
      title: "Andrea De Luca",
      handle: "@andrea4dl",
      avatarUrl: "https://yt3/h.jpg",
      subscribers: 37,
      videoCount: 34,
      uploadsPlaylistId: "UU-andrea",
    });
  });

  it("rend null pour une chaîne absente de la réponse", () => {
    expect(channelStats(payload, "UC-autre")).toBeNull();
  });

  it("n'invente pas de zéro quand la chaîne masque ses abonnés", () => {
    const hidden = {
      items: [{ id: "UC-x", statistics: { hiddenSubscriberCount: true, subscriberCount: "0" } }],
    };
    expect(channelStats(hidden, "UC-x")?.subscribers).toBeNull();
  });
});

describe("uploadsPage", () => {
  it("rend les identifiants dans l'ordre et le jeton de page suivante", () => {
    expect(
      uploadsPage({
        items: [
          { contentDetails: { videoId: "v2" } },
          { snippet: { resourceId: { videoId: "v1" } } },
          { contentDetails: {} },
        ],
        nextPageToken: "CAUQAA",
      }),
    ).toEqual({ videoIds: ["v2", "v1"], nextPageToken: "CAUQAA" });
  });

  it("lit une page vide sans lever", () => {
    expect(uploadsPage({})).toEqual({ videoIds: [], nextPageToken: null });
  });
});

describe("reportingVideos", () => {
  it("range une vidéo publiée avec ses vues, j'aime et commentaires", () => {
    expect(
      reportingVideos({
        items: [
          {
            id: "abc",
            snippet: {
              publishedAt: "2026-09-12T17:00:05Z",
              title: "Ma routine",
              thumbnails: { medium: { url: "https://i.ytimg/m.jpg" } },
            },
            statistics: { viewCount: "1520", likeCount: "84", commentCount: "9", favoriteCount: "0" },
            status: { privacyStatus: "public" },
          },
        ],
      }),
    ).toEqual([
      {
        externalId: "abc",
        publishedAt: "2026-09-12T17:00:05.000Z",
        caption: "Ma routine",
        permalink: "https://www.youtube.com/watch?v=abc",
        thumbnailUrl: "https://i.ytimg/m.jpg",
        views: 1520,
        likes: 84,
        comments: 9,
      },
    ]);
  });

  it("écarte une vidéo privée ou programmée, garde une non répertoriée", () => {
    const videos = reportingVideos({
      items: [
        { id: "p", snippet: { publishedAt: "2026-09-01T00:00:00Z" }, status: { privacyStatus: "private" } },
        { id: "u", snippet: { publishedAt: "2026-09-02T00:00:00Z" }, status: { privacyStatus: "unlisted" } },
      ],
    });
    expect(videos.map((video) => video.externalId)).toEqual(["u"]);
  });

  it("compte à zéro un compteur que la chaîne masque", () => {
    const [video] = reportingVideos({
      items: [{ id: "h", snippet: { publishedAt: "2026-09-03T00:00:00Z" }, statistics: { viewCount: "40" } }],
    });
    expect(video).toMatchObject({ views: 40, likes: 0, comments: 0 });
  });

  it("écarte une vidéo sans date lisible", () => {
    expect(reportingVideos({ items: [{ id: "n", snippet: { publishedAt: "hier" } }] })).toEqual([]);
  });
});
