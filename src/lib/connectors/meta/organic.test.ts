import { describe, expect, it } from "vitest";

import {
  insightValue,
  mediaToPost,
  pagePostKind,
  pagePostToPost,
  pageInsightsToDaily,
} from "./organic";

describe("insightValue", () => {
  const insights = {
    data: [
      { name: "reach", values: [{ value: 1200 }] },
      { name: "views", values: [{ value: "1500" }] },
    ],
  };

  it("lit une métrique par son nom, nombre ou chaîne", () => {
    expect(insightValue(insights, "reach")).toBe(1200);
    expect(insightValue(insights, "views")).toBe(1500);
  });

  it("rend 0 pour une métrique absente — absente vaut zéro", () => {
    // Un vieux média sans `views` ne doit pas faire tomber la ligne.
    expect(insightValue(insights, "saved")).toBe(0);
    expect(insightValue(undefined, "reach")).toBe(0);
  });
});

describe("mediaToPost", () => {
  it("traduit un média complet, insights compris", () => {
    const post = mediaToPost({
      id: "17900001",
      caption: "Nouvelle collection",
      permalink: "https://www.instagram.com/p/abc/",
      media_type: "IMAGE",
      media_url: "https://cdn.example/img.jpg",
      timestamp: "2026-08-02T10:00:00+0000",
      like_count: 210,
      comments_count: 14,
      insights: {
        data: [
          { name: "reach", values: [{ value: 3200 }] },
          { name: "views", values: [{ value: 4100 }] },
          { name: "saved", values: [{ value: 18 }] },
          { name: "shares", values: [{ value: 9 }] },
        ],
      },
    });

    expect(post?.external_id).toBe("17900001");
    expect(post?.reach).toBe(3200);
    // `views` remplit notre colonne impressions : même grandeur, nouveau nom.
    expect(post?.impressions).toBe(4100);
    expect(post?.likes).toBe(210);
    expect(post?.saves).toBe(18);
    expect(post?.thumbnail_url).toBe("https://cdn.example/img.jpg");
  });

  it("préfère la vignette vidéo à l'URL du média", () => {
    const post = mediaToPost({
      id: "1",
      media_type: "VIDEO",
      media_url: "https://cdn.example/video.mp4",
      thumbnail_url: "https://cdn.example/thumb.jpg",
      timestamp: "2026-08-02T10:00:00+0000",
    });
    expect(post?.thumbnail_url).toBe("https://cdn.example/thumb.jpg");
  });

  it("garde les compteurs publics quand les insights manquent", () => {
    // Le repli sans expansion : likes et commentaires restent.
    const post = mediaToPost({
      id: "2",
      timestamp: "2026-08-02T10:00:00+0000",
      like_count: 12,
      comments_count: 3,
    });
    expect(post?.likes).toBe(12);
    expect(post?.impressions).toBe(0);
  });

  it("saute un média sans date plutôt que d'en inventer une", () => {
    expect(mediaToPost({ id: "3" })).toBeNull();
  });
});

describe("pagePostToPost", () => {
  it("traduit un post de Page, résumés et insights compris", () => {
    const post = pagePostToPost({
      id: "123_456",
      message: "Portes ouvertes samedi",
      permalink_url: "https://www.facebook.com/123/posts/456",
      full_picture: "https://cdn.example/photo.jpg",
      created_time: "2026-08-03T09:00:00+0000",
      shares: { count: 7 },
      comments: { summary: { total_count: 11 } },
      reactions: { summary: { total_count: 89 } },
      insights: {
        data: [
          { name: "post_impressions", values: [{ value: 5400 }] },
          { name: "post_impressions_unique", values: [{ value: 4100 }] },
        ],
      },
    });

    expect(post?.impressions).toBe(5400);
    expect(post?.reach).toBe(4100);
    // Les réactions tiennent lieu de likes côté Facebook.
    expect(post?.likes).toBe(89);
    expect(post?.comments).toBe(11);
    expect(post?.shares).toBe(7);
    expect(post?.saves).toBe(0);
  });

  it("préfère « views » à « post_impressions » quand Meta rend les deux", () => {
    // Meta a déprécié `post_impressions` fin 2025 : c'est `views` qui vit.
    const post = pagePostToPost({
      id: "123_456",
      created_time: "2026-08-03T09:00:00+0000",
      insights: {
        data: [
          { name: "views", values: [{ value: 6100 }] },
          { name: "post_impressions", values: [{ value: 5400 }] },
        ],
      },
    });
    expect(post?.impressions).toBe(6100);
  });

  it("retombe sur « post_impressions » quand « views » manque", () => {
    // L'historique déjà collecté ne porte que l'ancien nom : le remettre à
    // zéro le jour de la bascule effacerait des chiffres bien réels.
    const post = pagePostToPost({
      id: "123_456",
      created_time: "2026-08-03T09:00:00+0000",
      insights: { data: [{ name: "post_impressions", values: [{ value: 5400 }] }] },
    });
    expect(post?.impressions).toBe(5400);
  });

  it("saute un post sans date", () => {
    expect(pagePostToPost({ id: "1" })).toBeNull();
  });

  it("lit les vues vidéo de Facebook au lieu de les déduire", () => {
    // `post_video_views` est une grandeur distincte des impressions.
    const post = pagePostToPost({
      id: "1",
      created_time: "2026-08-03T09:00:00+0000",
      attachments: { data: [{ media_type: "video" }] },
      insights: {
        data: [
          { name: "post_impressions", values: [{ value: 5000 }] },
          { name: "post_video_views", values: [{ value: 1800 }] },
        ],
      },
    });
    expect(post?.media_kind).toBe("video");
    expect(post?.video_views).toBe(1800);
    expect(post?.impressions).toBe(5000);
  });
});

describe("pagePostKind", () => {
  it("lit la nature du post sur sa pièce jointe", () => {
    // Facebook ne porte pas de champ « type » sur le post lui-même.
    expect(pagePostKind({ id: "1", attachments: { data: [{ media_type: "video" }] } })).toBe(
      "video",
    );
    expect(pagePostKind({ id: "1", attachments: { data: [{ media_type: "album" }] } })).toBe(
      "carousel",
    );
    expect(pagePostKind({ id: "1" })).toBe("image");
  });
});

describe("pageInsightsToDaily", () => {
  it("date chaque point du jour qu'il clôture, pas de son end_time", () => {
    // `end_time` = 07:00 UTC le lendemain : 2026-09-01T07:00 décrit le 31 août.
    const rows = pageInsightsToDaily([
      {
        name: "page_impressions",
        period: "day",
        values: [
          { value: 120, end_time: "2026-08-31T07:00:00+0000" },
          { value: 80, end_time: "2026-09-01T07:00:00+0000" },
        ],
      },
      {
        name: "page_impressions_unique",
        period: "day",
        values: [{ value: 100, end_time: "2026-09-01T07:00:00+0000" }],
      },
    ]);
    expect(rows).toEqual([
      { date: "2026-08-30", impressions: 120, reach: 0, engagements: 0, video_views: 0 },
      { date: "2026-08-31", impressions: 80, reach: 100, engagements: 0, video_views: 0 },
    ]);
  });

  it("ne somme jamais deux noms de la même grandeur pour un même jour", () => {
    /* Le défaut le plus coûteux de la bascule : `page_media_view` remplace
       `page_impressions`, et Meta peut rendre les deux pour la même journée.
       Les additionner doublerait les impressions en silence — aucun écran ne
       le dirait. Le nom vivant gagne, l'ancien ne s'y ajoute pas. */
    const rows = pageInsightsToDaily([
      {
        name: "page_media_view",
        period: "day",
        values: [{ value: 900, end_time: "2026-09-01T07:00:00+0000" }],
      },
      {
        name: "page_impressions",
        period: "day",
        values: [{ value: 880, end_time: "2026-09-01T07:00:00+0000" }],
      },
    ]);
    expect(rows).toEqual([
      { date: "2026-08-31", impressions: 900, reach: 0, engagements: 0, video_views: 0 },
    ]);
  });

  it("retombe sur le nom déprécié quand le nom vivant se tait", () => {
    const rows = pageInsightsToDaily([
      {
        name: "page_impressions",
        period: "day",
        values: [{ value: 880, end_time: "2026-09-01T07:00:00+0000" }],
      },
    ]);
    expect(rows[0]?.impressions).toBe(880);
  });

  it("ne compte qu'une fois un même relevé rendu deux fois", () => {
    // Deux tranches de 90 jours qui se recouvrent rendent le même point : une
    // seule mesure, pas deux parts.
    const point = { value: 500, end_time: "2026-09-01T07:00:00+0000" };
    const rows = pageInsightsToDaily([
      { name: "page_impressions_unique", period: "day", values: [point] },
      { name: "page_impressions_unique", period: "day", values: [point] },
    ]);
    expect(rows[0]?.reach).toBe(500);
  });

  it("ignore une métrique inconnue et une valeur illisible", () => {
    const rows = pageInsightsToDaily([
      { name: "page_fans", values: [{ value: 9, end_time: "2026-09-01T07:00:00+0000" }] },
      { name: "page_video_views", values: [{ value: "n/a", end_time: "2026-09-01T07:00:00+0000" }] },
    ]);
    expect(rows).toEqual([
      { date: "2026-08-31", impressions: 0, reach: 0, engagements: 0, video_views: 0 },
    ]);
  });
});
