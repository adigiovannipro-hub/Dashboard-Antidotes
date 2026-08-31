import { describe, expect, it } from "vitest";

import { isImagePath, previewPathFor } from "./storage";
import { visualThumbUrl, type ResolvedVisual } from "./types";

const visual = (overrides: Partial<ResolvedVisual> = {}): ResolvedVisual => ({
  path: "ws/sujet/1725-photo.jpg",
  url: "https://bucket/signed/photo.jpg?token=abc",
  previewUrl: null,
  name: "1725-photo.jpg",
  ...overrides,
});

describe("previewPathFor", () => {
  it("dérive la miniature du chemin de l'original", () => {
    expect(previewPathFor("ws/sujet/1725-reel.mp4")).toBe(
      "ws/sujet/1725-reel.mp4.preview.jpg",
    );
  });

  it("produit un chemin que isImagePath reconnaît — la miniature s'affiche comme une image", () => {
    expect(isImagePath(previewPathFor("ws/sujet/1725-reel.mp4"))).toBe(true);
  });
});

describe("visualThumbUrl", () => {
  it("préfère la miniature quand elle existe", () => {
    expect(
      visualThumbUrl(visual({ previewUrl: "https://bucket/preview.jpg?token=p" })),
    ).toBe("https://bucket/preview.jpg?token=p");
  });

  it("retombe sur l'original pour une image sans miniature", () => {
    expect(visualThumbUrl(visual())).toBe(
      "https://bucket/signed/photo.jpg?token=abc",
    );
  });

  it("rend le poster d'une vidéo qui en a un", () => {
    expect(
      visualThumbUrl(
        visual({
          path: "ws/sujet/1725-reel.mp4",
          previewUrl: "https://bucket/reel-poster.jpg?token=p",
        }),
      ),
    ).toBe("https://bucket/reel-poster.jpg?token=p");
  });

  it("ne rend rien pour une vidéo sans poster ni un PDF — la cellule garde son trombone", () => {
    expect(visualThumbUrl(visual({ path: "ws/sujet/1725-reel.mp4" }))).toBeNull();
    expect(visualThumbUrl(visual({ path: "ws/sujet/1725-plan.pdf" }))).toBeNull();
  });

  it("ignore une image dont l'URL signée manque", () => {
    expect(visualThumbUrl(visual({ url: "" }))).toBeNull();
  });
});
