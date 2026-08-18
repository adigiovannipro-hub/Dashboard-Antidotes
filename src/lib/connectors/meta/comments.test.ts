import { describe, expect, it } from "vitest";

import {
  igCommentsToThreads,
  mediaToCommentedPost,
  pageCommentsToThreads,
  pagePostToCommentedPost,
} from "./comments";
import type {
  MetaIgCommentRow,
  MetaIgMediaLite,
  MetaPageCommentRow,
  MetaPagePostLite,
} from "./comments";

const media = (over: Partial<MetaIgMediaLite> = {}): MetaIgMediaLite => ({
  id: "media-1",
  caption: "Nouvelle collection en boutique ✨",
  permalink: "https://www.instagram.com/p/abc/",
  timestamp: "2026-08-01T09:00:00+0000",
  media_url: "https://cdn.example.com/image.jpg",
  ...over,
});

const igComment = (over: Partial<MetaIgCommentRow> = {}): MetaIgCommentRow => ({
  id: "c1",
  text: "Il existe en bleu ?",
  timestamp: "2026-08-02T10:00:00+0000",
  username: "claire.d",
  from: { id: "u-claire", username: "claire.d" },
  ...over,
});

const pagePost = (over: Partial<MetaPagePostLite> = {}): MetaPagePostLite => ({
  id: "page-1_post-1",
  message: "Portes ouvertes samedi !",
  permalink_url: "https://www.facebook.com/post/1",
  full_picture: "https://cdn.example.com/cover.jpg",
  created_time: "2026-08-01T09:00:00+0000",
  ...over,
});

const pageComment = (over: Partial<MetaPageCommentRow> = {}): MetaPageCommentRow => ({
  id: "fb-c1",
  message: "C'est ouvert jusqu'à quelle heure ?",
  created_time: "2026-08-02T10:00:00+0000",
  from: { id: "u-marc", name: "Marc Petit" },
  ...over,
});

const BRAND = { externalId: "ig-brand", username: "bondet" };
const PAGE_BRAND = { externalId: "page-1" };

describe("mediaToCommentedPost", () => {
  it("résume la légende et normalise l'horodatage", () => {
    const post = mediaToCommentedPost(media());
    expect(post.excerpt).toBe("Nouvelle collection en boutique ✨");
    expect(post.publishedAt).toBe("2026-08-01T09:00:00.000Z");
  });

  it("préfère la vignette au média — une vidéo ne s'affiche pas en <img>", () => {
    const post = mediaToCommentedPost(
      media({ thumbnail_url: "https://cdn.example.com/mini.jpg" }),
    );
    expect(post.thumbnailUrl).toBe("https://cdn.example.com/mini.jpg");
  });
});

describe("pagePostToCommentedPost", () => {
  it("rend null pour un post sans texte plutôt qu'une chaîne vide", () => {
    const post = pagePostToCommentedPost(pagePost({ message: undefined }));
    expect(post.excerpt).toBeNull();
    expect(post.thumbnailUrl).toBe("https://cdn.example.com/cover.jpg");
  });
});

describe("igCommentsToThreads", () => {
  it("fait d'un commentaire de tête et de ses réponses un fil chronologique", () => {
    const threads = igCommentsToThreads({
      media: media(),
      comments: [
        igComment({
          replies: {
            data: [
              igComment({
                id: "c1-r1",
                text: "Oui, dès la semaine prochaine !",
                timestamp: "2026-08-02T11:00:00+0000",
                username: "bondet",
                from: { id: "ig-brand", username: "bondet" },
              }),
            ],
          },
        }),
      ],
      brand: BRAND,
    });

    expect(threads).toHaveLength(1);
    const thread = threads[0]!;
    expect(thread.externalThreadId).toBe("c1");
    expect(thread.kind).toBe("comment");
    expect(thread.participantHandle).toBe("claire.d");
    expect(thread.messages.map((message) => message.externalId)).toEqual([
      "c1",
      "c1-r1",
    ]);
    expect(thread.messages[1]!.fromBrand).toBe(true);
    expect(thread.post?.permalink).toBe("https://www.instagram.com/p/abc/");
  });

  it("reconnaît la marque au nom d'utilisateur, sans tenir compte de la casse", () => {
    const threads = igCommentsToThreads({
      media: media(),
      comments: [
        igComment(),
        igComment({
          id: "c2",
          text: "#nouveauté #boutique",
          username: "Bondet",
          from: undefined,
        }),
      ],
      brand: BRAND,
    });

    // Le commentaire à hashtags de la marque, sans réponse, n'est pas un fil.
    expect(threads).toHaveLength(1);
    expect(threads[0]!.externalThreadId).toBe("c1");
  });

  it("garde le fil ouvert sous un commentaire de la marque quand un client y répond", () => {
    const threads = igCommentsToThreads({
      media: media(),
      comments: [
        igComment({
          id: "c3",
          text: "Disponible en boutique !",
          username: "bondet",
          from: { id: "ig-brand", username: "bondet" },
          replies: {
            data: [
              igComment({
                id: "c3-r1",
                text: "Et en ligne ?",
                timestamp: "2026-08-03T10:00:00+0000",
              }),
            ],
          },
        }),
      ],
      brand: BRAND,
    });

    expect(threads).toHaveLength(1);
    expect(threads[0]!.participantHandle).toBe("claire.d");
  });
});

describe("pageCommentsToThreads — pièces jointes", () => {
  it("garde le GIF d'un commentaire sans texte", () => {
    const threads = pageCommentsToThreads({
      post: pagePost(),
      comments: [
        pageComment({
          message: undefined,
          attachment: {
            type: "animated_image_share",
            title: "Applause",
            media: { image: { src: "https://cdn.example.com/clap.gif" } },
            target: { url: "https://giphy.com/clap" },
          },
        }),
      ],
      brand: PAGE_BRAND,
    });

    const attachment = threads[0]!.messages[0]!.attachments[0]!;
    expect(attachment.type).toBe("animated_image_share");
    expect(attachment.url).toBe("https://cdn.example.com/clap.gif");
    expect(attachment.href).toBe("https://giphy.com/clap");
  });

  it("n'invente pas de pièce jointe quand Meta n'en rend pas", () => {
    const threads = pageCommentsToThreads({
      post: pagePost(),
      comments: [pageComment()],
      brand: PAGE_BRAND,
    });
    expect(threads[0]!.messages[0]!.attachments).toEqual([]);
  });
});

describe("pageCommentsToThreads", () => {
  it("regroupe le flux à plat par commentaire de tête", () => {
    const threads = pageCommentsToThreads({
      post: pagePost(),
      comments: [
        pageComment(),
        pageComment({
          id: "fb-c2",
          message: "Jusqu'à 19h !",
          created_time: "2026-08-02T11:00:00+0000",
          from: { id: "page-1", name: "Bondet" },
          parent: { id: "fb-c1" },
        }),
      ],
      brand: PAGE_BRAND,
    });

    expect(threads).toHaveLength(1);
    const thread = threads[0]!;
    expect(thread.channel).toBe("facebook");
    expect(thread.externalThreadId).toBe("fb-c1");
    expect(thread.messages).toHaveLength(2);
    expect(thread.messages[1]!.fromBrand).toBe(true);
  });

  it("rattache une réponse orpheline à la clé de son parent disparu", () => {
    const threads = pageCommentsToThreads({
      post: pagePost(),
      comments: [
        pageComment({
          id: "fb-c9",
          message: "Ma réponse survit au commentaire supprimé",
          parent: { id: "fb-effacé" },
        }),
      ],
      brand: PAGE_BRAND,
    });

    expect(threads).toHaveLength(1);
    expect(threads[0]!.externalThreadId).toBe("fb-effacé");
  });

  it("accepte un auteur masqué par Facebook — le fil s'affiche « Inconnu »", () => {
    const threads = pageCommentsToThreads({
      post: pagePost(),
      comments: [pageComment({ from: undefined })],
      brand: PAGE_BRAND,
    });

    expect(threads).toHaveLength(1);
    expect(threads[0]!.participantHandle).toBeNull();
  });
});
