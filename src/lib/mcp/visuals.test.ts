// @vitest-environment node
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ContentBlock } from "./protocol";
import {
  collectVisuals,
  prepareImage,
  RAW_IMAGE_MAX_BYTES,
  rawImageBlock,
  selectIndexes,
  SharpUnavailableError,
  sniffImageMime,
  storagePaths,
  visualKind,
  visualLines,
  type VisualStorage,
} from "./visuals";

const png = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 30, g: 120, b: 60 } } })
    .png()
    .toBuffer()
    .then((buffer) => new Uint8Array(buffer));

/** Un faux bucket : des octets par chemin, et un journal de ce qu'on lui a demandé. */
const fakeStorage = (files: Record<string, Uint8Array>) => {
  const downloads: string[] = [];
  const storage: VisualStorage = {
    download: async (path) => {
      downloads.push(path);
      return files[path] ?? null;
    },
    sign: async (paths) =>
      new Map(paths.filter((path) => path in files).map((path) => [path, `https://signe/${path}?token=1h`])),
  };
  return { storage, downloads };
};

const images = (content: ContentBlock[] | undefined) =>
  (content ?? []).filter((block): block is Extract<ContentBlock, { type: "image" }> => block.type === "image");

const texts = (content: ContentBlock[] | undefined) =>
  (content ?? [])
    .filter((block): block is Extract<ContentBlock, { type: "text" }> => block.type === "text")
    .map((block) => block.text);

describe("visualKind", () => {
  it("reconnaît image, vidéo et document à l'extension", () => {
    expect(visualKind("ws/sub/1-photo.JPG")).toBe("image");
    expect(visualKind("ws/sub/1-reel.mov")).toBe("vidéo");
    expect(visualKind("ws/sub/1-brief.pdf")).toBe("document");
    expect(visualKind("ws/sub/1-archive.zip")).toBe("fichier");
  });
});

describe("storagePaths", () => {
  it("ne garde que les chemins du bucket, sans doublon", () => {
    expect(storagePaths(["a.png", "https://ext/b.png", "a.png", "c.mp4"])).toEqual(["a.png", "c.mp4"]);
  });
});

describe("visualLines", () => {
  it("rend ordre, type et URL signée, et dit le fichier perdu plutôt qu'une URL morte", () => {
    const signed = new Map([["ws/s/1-a.png", "https://signe/a"]]);
    expect(visualLines(["ws/s/1-a.png", "ws/s/2-b.mp4", "https://ext/c.jpg"], signed)).toEqual([
      "  - visuel 1 · image · https://signe/a",
      "  - visuel 2 · vidéo · URL indisponible (fichier introuvable)",
      "  - visuel 3 · image · https://ext/c.jpg",
    ]);
  });
});

describe("selectIndexes", () => {
  it("rend tous les visuels sans index, et un seul avec", () => {
    expect(selectIndexes(3, undefined)).toEqual([0, 1, 2]);
    expect(selectIndexes(3, 2)).toEqual([1]);
    expect(selectIndexes(3, "3")).toEqual([2]);
  });

  it("refuse un index hors de la publication en disant lesquels existent", () => {
    expect(() => selectIndexes(3, 4)).toThrow("index de 1 à 3");
    expect(() => selectIndexes(3, 0)).toThrow("index de 1 à 3");
    expect(() => selectIndexes(3, 1.5)).toThrow();
  });
});

describe("prepareImage", () => {
  it("ramène une grande image à 1 568 px sur son plus grand côté, en JPEG", async () => {
    const result = await prepareImage(await png(3000, 2000), 1568);
    expect(result.mimeType).toBe("image/jpeg");
    expect([result.width, result.height]).toEqual([1568, 1045]);
    const bytes = Buffer.from(result.data, "base64");
    expect([bytes[0], bytes[1]]).toEqual([0xff, 0xd8]);
    const meta = await sharp(bytes).metadata();
    expect(meta.format).toBe("jpeg");
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(1568);
  });

  it("n'agrandit jamais une petite image", async () => {
    const result = await prepareImage(await png(400, 300), 1568);
    expect([result.width, result.height]).toEqual([400, 300]);
  });
});

describe("sniffImageMime", () => {
  it("lit le format dans les premiers octets, pas dans l'extension", async () => {
    expect(sniffImageMime(await png(2, 2))).toBe("image/png");
    expect(sniffImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageMime(new TextEncoder().encode("GIF89a"))).toBe("image/gif");
    expect(sniffImageMime(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
  });

  it("ne reconnaît pas ce qu'un modèle ne lit pas", () => {
    expect(sniffImageMime(new TextEncoder().encode("\0\0\0\x18ftypheic"))).toBeNull();
    expect(sniffImageMime(new Uint8Array([]))).toBeNull();
  });
});

describe("rawImageBlock", () => {
  it("rend l'original en base64 sous 5 Mo", async () => {
    const bytes = await png(4, 4);
    expect(rawImageBlock(bytes)).toEqual({ data: Buffer.from(bytes).toString("base64"), mimeType: "image/png" });
  });

  it("refuse 5 Mo et plus, et un format inconnu", () => {
    const heavy = new Uint8Array(RAW_IMAGE_MAX_BYTES);
    heavy.set([0xff, 0xd8, 0xff]);
    expect(rawImageBlock(heavy)).toBeNull();
    expect(rawImageBlock(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe("prepareImage, sans sharp", () => {
  it("traduit un module introuvable en SharpUnavailableError", async () => {
    const load = () =>
      Promise.reject(new Error("Could not load the sharp module using the linux-x64 runtime"));
    await expect(prepareImage(await png(10, 10), 1568, load)).rejects.toBeInstanceOf(SharpUnavailableError);
  });
});

describe("collectVisuals, sans sharp", () => {
  const sharpMissing = async (): Promise<never> => {
    throw new SharpUnavailableError(new Error("ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.6"));
  };
  const errors = () => vi.spyOn(console, "error").mockImplementation(() => {});

  afterEach(() => vi.restoreAllMocks());

  it("rend l'original tel quel sous 5 Mo, et met l'erreur au journal plutôt que dans la réponse", async () => {
    const log = errors();
    const original = await png(3000, 2000);
    const { storage } = fakeStorage({ "ws/s/1-a.png": original });
    const result = await collectVisuals({
      name: "Post",
      visualUrls: ["ws/s/1-a.png"],
      index: 1,
      storage,
      prepare: sharpMissing,
    });

    expect(images(result.content)).toEqual([
      { type: "image", data: Buffer.from(original).toString("base64"), mimeType: "image/png" },
    ]);
    expect(texts(result.content)).toContain("visuel 1 · image · original");
    expect(result.text).not.toContain("libvips");
    expect(result.isError).toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("libvips-cpp.so.8.18.6"));
  });

  it("rend la miniature d'un lot telle quelle", async () => {
    errors();
    const preview = await png(1080, 720);
    const { storage } = fakeStorage({ "ws/s/1-a.png": await png(10, 10), "ws/s/1-a.png.preview.jpg": preview });
    const result = await collectVisuals({
      name: "Lot",
      visualUrls: ["ws/s/1-a.png", "https://ext/b.png"],
      storage,
      prepare: sharpMissing,
    });
    expect(images(result.content)[0]?.data).toBe(Buffer.from(preview).toString("base64"));
  });

  it("au-delà de 5 Mo, ne rend que l'URL signée", async () => {
    errors();
    const heavy = new Uint8Array(RAW_IMAGE_MAX_BYTES + 1);
    heavy.set([0xff, 0xd8, 0xff]);
    const { storage } = fakeStorage({ "ws/s/1-a.jpg": heavy });
    const result = await collectVisuals({
      name: "Lourd",
      visualUrls: ["ws/s/1-a.jpg"],
      index: 1,
      storage,
      prepare: sharpMissing,
    });
    expect(images(result.content)).toHaveLength(0);
    expect(result.text).toContain("visuel 1 · image · URL signée (1 h) : https://signe/ws/s/1-a.jpg?token=1h");
    expect(result.text).not.toContain("libvips");
  });

  it("une image corrompue ne part jamais en clair, et son erreur reste au journal", async () => {
    const log = errors();
    const { storage } = fakeStorage({ "ws/s/1-a.jpg": new Uint8Array([0xff, 0xd8, 0xff, 0x00]) });
    const result = await collectVisuals({
      name: "Abîmée",
      visualUrls: ["ws/s/1-a.jpg"],
      index: 1,
      storage,
      prepare: async () => {
        throw new Error("VipsJpeg: Premature end of input file");
      },
    });
    expect(images(result.content)).toHaveLength(0);
    expect(result.text).toContain("visuel 1 · image · image illisible · URL signée (1 h)");
    expect(result.text).not.toContain("Premature");
    expect(log).toHaveBeenCalledOnce();
  });
});

describe("collectVisuals", () => {
  it("rend un visuel seul depuis l'original, en 1 568 px, précédé de sa légende", async () => {
    const { storage, downloads } = fakeStorage({ "ws/s/1-a.png": await png(3000, 2000) });
    const result = await collectVisuals({ name: "Post", visualUrls: ["ws/s/1-a.png"], index: 1, storage });

    expect(downloads).toEqual(["ws/s/1-a.png"]);
    expect(texts(result.content)).toContain("visuel 1 · image · 1568×1045");
    const [image] = images(result.content);
    expect(image?.mimeType).toBe("image/jpeg");
    expect(Buffer.from(image!.data, "base64").subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(result.isError).toBeUndefined();
  });

  it("rend un lot dans l'ordre, depuis les miniatures quand elles existent", async () => {
    const { storage, downloads } = fakeStorage({
      "ws/s/1-a.png": await png(3000, 2000),
      "ws/s/1-a.png.preview.jpg": await png(1080, 720),
      "ws/s/2-b.png": await png(2000, 2000),
    });
    const result = await collectVisuals({
      name: "Carrousel",
      visualUrls: ["ws/s/1-a.png", "ws/s/2-b.png"],
      storage,
    });

    expect(downloads).toEqual(["ws/s/1-a.png.preview.jpg", "ws/s/2-b.png.preview.jpg", "ws/s/2-b.png"]);
    expect(images(result.content)).toHaveLength(2);
    expect(texts(result.content)).toEqual([
      "« Carrousel » — 2 visuels, dans l'ordre de publication.",
      "visuel 1 · image · 1080×720",
      "visuel 2 · image · 1080×1080",
    ]);
  });

  it("rend une vidéo par sa première image et son URL signée", async () => {
    const { storage } = fakeStorage({
      "ws/s/1-reel.mp4": new Uint8Array([0, 0, 0]),
      "ws/s/1-reel.mp4.preview.jpg": await png(720, 1280),
    });
    const result = await collectVisuals({ name: "Reel", visualUrls: ["ws/s/1-reel.mp4"], storage });
    expect(images(result.content)).toHaveLength(1);
    expect(texts(result.content).join("\n")).toContain(
      "visuel 1 · vidéo · première image ci-dessous · la vidéo : https://signe/ws/s/1-reel.mp4?token=1h",
    );
  });

  it("dit l'absence de miniature d'une vidéo plutôt que de télécharger le film", async () => {
    const { storage, downloads } = fakeStorage({ "ws/s/1-reel.mp4": new Uint8Array([0, 0, 0]) });
    const result = await collectVisuals({ name: "Reel", visualUrls: ["ws/s/1-reel.mp4"], storage });
    expect(downloads).toEqual(["ws/s/1-reel.mp4.preview.jpg"]);
    expect(images(result.content)).toHaveLength(0);
    expect(result.text).toContain("pas de miniature · URL signée (1 h) : https://signe/ws/s/1-reel.mp4?token=1h");
  });

  it("ne télécharge jamais une URL externe, et nomme un fichier disparu", async () => {
    const { storage, downloads } = fakeStorage({});
    const result = await collectVisuals({
      name: "Post",
      visualUrls: ["https://monday.example/img.png", "ws/s/perdu.png"],
      storage,
    });
    expect(downloads).toEqual([]);
    expect(result.text).toContain("visuel 1 · image · lien externe, non chargé : https://monday.example/img.png");
    expect(result.text).toContain("visuel 2 · image · fichier introuvable dans le stockage.");
  });

  it("arrête de joindre au-delà du budget et dit comment reprendre", async () => {
    const { storage } = fakeStorage({
      "ws/s/1-a.png": await png(1080, 1080),
      "ws/s/2-b.png": await png(1080, 1080),
    });
    const result = await collectVisuals({
      name: "Lourd",
      visualUrls: ["ws/s/1-a.png", "ws/s/2-b.png"],
      storage,
      budget: 1,
    });
    expect(images(result.content)).toHaveLength(1);
    expect(result.text).toContain("visuel 2 · image · non joint, le lot est complet : rappeler lire_visuels avec index 2.");
  });

  it("le dit quand la publication n'a aucun visuel", async () => {
    const { storage } = fakeStorage({});
    const result = await collectVisuals({ name: "Vide", visualUrls: [], storage });
    expect(result).toEqual({ text: "Aucun visuel sur « Vide »." });
  });
});
