import { describe, expect, it } from "vitest";

import {
  threadsToConversations,
  threadToConversation,
  videoIdsOf,
} from "./comments";
import type {
  YouTubeComment,
  YouTubeCommentThread,
  YouTubeVideoLite,
} from "./comments";

const BRAND = "UC-brand";

const comment = (over: Partial<YouTubeComment> = {}): YouTubeComment => ({
  id: "c1",
  snippet: {
    textOriginal: "Vous roulez sur quel circuit ?",
    authorDisplayName: "Julien M.",
    authorProfileImageUrl: "https://yt3.example/julien.jpg",
    authorChannelId: { value: "UC-julien" },
    publishedAt: "2026-08-16T10:00:00Z",
    videoId: "vid-1",
  },
  ...over,
});

const thread = (over: Partial<YouTubeCommentThread> = {}): YouTubeCommentThread => ({
  id: "t1",
  snippet: { videoId: "vid-1", totalReplyCount: 0, topLevelComment: comment() },
  ...over,
});

const video = (over: Partial<YouTubeVideoLite> = {}): YouTubeVideoLite => ({
  id: "vid-1",
  snippet: {
    title: "320 km/h en simulateur : la session complète",
    publishedAt: "2026-08-01T09:00:00Z",
    thumbnails: {
      default: { url: "https://i.ytimg.com/default.jpg" },
      medium: { url: "https://i.ytimg.com/medium.jpg" },
      maxres: { url: "https://i.ytimg.com/maxres.jpg" },
    },
  },
  ...over,
});

describe("threadToConversation", () => {
  it("fait d'un fil YouTube une conversation, vidéo comprise", () => {
    const conversation = threadToConversation({
      thread: thread(),
      video: video(),
      brandChannelId: BRAND,
    })!;

    expect(conversation.channel).toBe("youtube");
    expect(conversation.kind).toBe("comment");
    expect(conversation.externalThreadId).toBe("t1");
    expect(conversation.participantHandle).toBe("Julien M.");
    expect(conversation.post?.permalink).toBe(
      "https://www.youtube.com/watch?v=vid-1",
    );
    expect(conversation.post?.excerpt).toBe(
      "320 km/h en simulateur : la session complète",
    );
  });

  it("prend la vignette moyenne — l'inbox l'affiche en 36 px", () => {
    const conversation = threadToConversation({
      thread: thread(),
      video: video(),
      brandChannelId: BRAND,
    })!;
    expect(conversation.post?.thumbnailUrl).toBe("https://i.ytimg.com/medium.jpg");
  });

  it("garde le texte brut : `textDisplay` porte le HTML de YouTube", () => {
    const conversation = threadToConversation({
      thread: thread({
        snippet: {
          videoId: "vid-1",
          topLevelComment: comment({
            snippet: {
              textOriginal: "Super vidéo !\nBravo",
              textDisplay: "Super vidéo !<br>Bravo",
              authorDisplayName: "Julien M.",
              authorChannelId: { value: "UC-julien" },
              publishedAt: "2026-08-16T10:00:00Z",
            },
          }),
        },
      }),
      video: video(),
      brandChannelId: BRAND,
    })!;

    expect(conversation.messages[0]!.body).toBe("Super vidéo !\nBravo");
  });

  it("reconnaît nos réponses au canal de la marque et les range dans l'ordre", () => {
    const conversation = threadToConversation({
      thread: thread({
        replies: {
          comments: [
            comment({
              id: "c1-r1",
              snippet: {
                textOriginal: "Sur le circuit de Lyon !",
                authorDisplayName: "I-WAY",
                authorChannelId: { value: BRAND },
                publishedAt: "2026-08-16T11:00:00Z",
              },
            }),
          ],
        },
      }),
      video: video(),
      brandChannelId: BRAND,
    })!;

    expect(conversation.messages.map((message) => message.externalId)).toEqual([
      "c1",
      "c1-r1",
    ]);
    expect(conversation.messages[1]!.fromBrand).toBe(true);
    expect(conversation.participantHandle).toBe("Julien M.");
  });

  it("écarte un fil où seule la marque a parlé", () => {
    const conversation = threadToConversation({
      thread: thread({
        snippet: {
          videoId: "vid-1",
          topLevelComment: comment({
            snippet: {
              textOriginal: "Abonnez-vous !",
              authorDisplayName: "I-WAY",
              authorChannelId: { value: BRAND },
              publishedAt: "2026-08-16T10:00:00Z",
            },
          }),
        },
      }),
      video: video(),
      brandChannelId: BRAND,
    });

    expect(conversation).toBeNull();
  });

  it("tient sans la vidéo : le fil reste lisible, la publication non décrite", () => {
    const conversation = threadToConversation({
      thread: thread(),
      video: undefined,
      brandChannelId: BRAND,
    })!;

    expect(conversation.post?.excerpt).toBeNull();
    expect(conversation.post?.thumbnailUrl).toBeNull();
    expect(conversation.post?.permalink).toBe(
      "https://www.youtube.com/watch?v=vid-1",
    );
  });
});

describe("threadsToConversations", () => {
  it("rattache chaque fil à sa vidéo", () => {
    const conversations = threadsToConversations({
      threads: [
        thread(),
        thread({
          id: "t2",
          snippet: {
            videoId: "vid-2",
            topLevelComment: comment({ id: "c2", snippet: { ...comment().snippet, videoId: "vid-2" } }),
          },
        }),
      ],
      videos: new Map([
        ["vid-1", video()],
        ["vid-2", video({ id: "vid-2", snippet: { title: "Les coulisses" } })],
      ]),
      brandChannelId: BRAND,
    });

    expect(conversations).toHaveLength(2);
    expect(conversations[1]!.post?.excerpt).toBe("Les coulisses");
  });
});

describe("videoIdsOf", () => {
  it("dédoublonne les vidéos à décrire", () => {
    expect(videoIdsOf([thread(), thread({ id: "t2" })])).toEqual(["vid-1"]);
  });
});
