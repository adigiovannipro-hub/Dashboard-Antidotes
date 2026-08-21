import { describe, expect, it } from "vitest";

import { embedUrl, parseVideoUrl } from "./video";

describe("parseVideoUrl", () => {
  it("reconnaît toutes les formes d'URL YouTube", () => {
    const attendu = { provider: "youtube", id: "dQw4w9WgXcQ" };
    expect(parseVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual(attendu);
    expect(parseVideoUrl("https://youtu.be/dQw4w9WgXcQ")).toEqual(attendu);
    expect(parseVideoUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")).toEqual(attendu);
    expect(parseVideoUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toEqual(attendu);
    expect(parseVideoUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=42s")).toEqual(attendu);
    expect(
      parseVideoUrl("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"),
    ).toEqual(attendu);
  });

  it("reconnaît Vimeo, lien public comme lien privé", () => {
    expect(parseVideoUrl("https://vimeo.com/123456789")).toEqual({
      provider: "vimeo",
      id: "123456789",
    });
    expect(parseVideoUrl("https://player.vimeo.com/video/123456789")).toEqual({
      provider: "vimeo",
      id: "123456789",
    });
    // Le hash d'un lien privé fait partie de l'identifiant : sans lui,
    // l'embed répond « vidéo introuvable ».
    expect(parseVideoUrl("https://vimeo.com/123456789/abcdef1234")).toEqual({
      provider: "vimeo",
      id: "123456789/abcdef1234",
    });
  });

  it("reconnaît un identifiant de lecture Mux", () => {
    expect(parseVideoUrl("https://player.mux.com/DS00Spx1CV902MCtPj5WknGlR102V5HFkDe")).toEqual({
      provider: "mux",
      id: "DS00Spx1CV902MCtPj5WknGlR102V5HFkDe",
    });
    expect(parseVideoUrl("https://stream.mux.com/DS00Spx1CV902MCtPj5WknGlR102V5HFkDe.m3u8")).toEqual({
      provider: "mux",
      id: "DS00Spx1CV902MCtPj5WknGlR102V5HFkDe",
    });
  });

  it("refuse ce qui n'est pas une URL vidéo reconnue", () => {
    expect(parseVideoUrl("")).toBeNull();
    expect(parseVideoUrl("pas une url")).toBeNull();
    expect(parseVideoUrl("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(parseVideoUrl("https://www.youtube.com/watch?v=trop-court")).toBeNull();
    expect(parseVideoUrl("ftp://youtu.be/dQw4w9WgXcQ")).toBeNull();
    expect(parseVideoUrl("https://vimeo.com/apropos")).toBeNull();
  });
});

describe("embedUrl", () => {
  it("construit l'iframe de chaque fournisseur", () => {
    expect(embedUrl({ provider: "youtube", id: "dQw4w9WgXcQ" })).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0",
    );
    expect(embedUrl({ provider: "vimeo", id: "123456789" })).toBe(
      "https://player.vimeo.com/video/123456789",
    );
    expect(embedUrl({ provider: "vimeo", id: "123456789/abcdef1234" })).toBe(
      "https://player.vimeo.com/video/123456789?h=abcdef1234",
    );
    expect(embedUrl({ provider: "mux", id: "DS00Spx1CV902MCtPj5WknGlR102V5HFkDe" })).toBe(
      "https://player.mux.com/DS00Spx1CV902MCtPj5WknGlR102V5HFkDe",
    );
  });
});
