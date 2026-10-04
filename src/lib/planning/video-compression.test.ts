import { describe, expect, it } from "vitest";

import { MAX_VISUAL_BYTES, visualUploadError } from "./storage";
import {
  COMPRESSION_TARGET_BYTES,
  MAX_VIDEO_BITRATE,
  compressedName,
  formatDuration,
  needsCompression,
  planCompression,
  planRetry,
} from "./video-compression";

const MO = 1024 * 1024;

const file = (overrides: Partial<{ name: string; type: string; size: number }> = {}) => ({
  name: "master.mp4",
  type: "video/mp4",
  size: 120 * MO,
  ...overrides,
});

describe("needsCompression", () => {
  it("retient une vidéo au-dessus de 50 Mo", () => {
    expect(needsCompression(file())).toBe(true);
  });

  it("laisse partir telle quelle une vidéo sous 50 Mo", () => {
    expect(needsCompression(file({ size: 30 * MO }))).toBe(false);
  });

  it("reconnaît une vidéo arrivée sans type MIME par son extension", () => {
    expect(needsCompression(file({ name: "rush.MOV", type: "" }))).toBe(true);
  });

  it("ne touche jamais une image lourde", () => {
    expect(needsCompression(file({ name: "affiche.png", type: "image/png" }))).toBe(false);
  });
});

describe("visualUploadError", () => {
  it("laisse passer une vidéo de 120 Mo — elle sera compressée", () => {
    expect(visualUploadError([file()])).toBeNull();
  });

  it("refuse une vidéo au-delà de 2 Go", () => {
    expect(visualUploadError([file({ size: 3 * 1024 * MO })])).toMatch(/2 Go maximum/);
  });

  it("refuse toujours une image au-delà de 50 Mo", () => {
    expect(
      visualUploadError([file({ name: "affiche.png", type: "image/png", size: MAX_VISUAL_BYTES + 1 })]),
    ).toMatch(/50 Mo maximum/);
  });
});

describe("planCompression", () => {
  it("garde le 1080 d'un reel de 45 s et vise sous la cible", () => {
    const plan = planCompression({
      durationSeconds: 45,
      displayWidth: 1080,
      displayHeight: 1920,
      audioBitrate: 128_000,
    });
    expect(plan).toMatchObject({ ok: true, width: 1080, height: 1920 });
    if (!plan.ok) return;
    const bytes = ((plan.videoBitrate + 128_000) * 45) / 8;
    expect(bytes).toBeLessThanOrEqual(COMPRESSION_TARGET_BYTES);
  });

  it("ramène un master 4K vertical à 1080 de large, en dimensions paires", () => {
    const plan = planCompression({
      durationSeconds: 60,
      displayWidth: 2160,
      displayHeight: 3840,
      audioBitrate: 128_000,
    });
    expect(plan).toMatchObject({ ok: true, width: 1080, height: 1920 });
  });

  it("descend en 720 quand le débit ne suffit plus pour du 1080 propre", () => {
    const plan = planCompression({
      durationSeconds: 180,
      displayWidth: 1920,
      displayHeight: 1080,
      audioBitrate: 128_000,
    });
    expect(plan).toMatchObject({ ok: true, width: 1280, height: 720 });
  });

  it("plafonne le débit d'une vidéo très courte", () => {
    const plan = planCompression({
      durationSeconds: 5,
      displayWidth: 1080,
      displayHeight: 1920,
      audioBitrate: 128_000,
    });
    expect(plan.ok && plan.videoBitrate).toBe(MAX_VIDEO_BITRATE);
  });

  it("refuse une vidéo trop longue plutôt que de la rendre illisible", () => {
    expect(
      planCompression({
        durationSeconds: 15 * 60,
        displayWidth: 1080,
        displayHeight: 1920,
        audioBitrate: 128_000,
      }),
    ).toEqual({ ok: false, reason: "too_long" });
  });

  it("refuse une durée illisible", () => {
    expect(
      planCompression({ durationSeconds: 0, displayWidth: 1080, displayHeight: 1920, audioBitrate: 0 }),
    ).toEqual({ ok: false, reason: "unreadable" });
  });
});

describe("planRetry", () => {
  it("réduit le débit au-delà de la proportion du débordement", () => {
    const next = planRetry({ videoBitrate: 6_000_000, width: 1080, height: 1920 }, 55 * MO);
    expect(next.videoBitrate).toBeLessThan(6_000_000 * (COMPRESSION_TARGET_BYTES / (55 * MO)));
  });

  it("descend d'un cran de définition à chaque passage", () => {
    const second = planRetry({ videoBitrate: 6_000_000, width: 1080, height: 1920 }, 55 * MO);
    expect(second).toMatchObject({ width: 720, height: 1280 });
    const third = planRetry(second, 55 * MO);
    expect(third).toMatchObject({ width: 540, height: 960 });
  });

  it("ne remonte jamais une petite définition", () => {
    const next = planRetry({ videoBitrate: 1_000_000, width: 480, height: 854 }, 55 * MO);
    expect(next).toMatchObject({ width: 480, height: 854 });
  });
});

describe("formatDuration", () => {
  it("dit les minutes et les secondes", () => {
    expect(formatDuration(252)).toBe("4 min 12 s");
    expect(formatDuration(600)).toBe("10 min");
    expect(formatDuration(42.4)).toBe("42 s");
  });
});

describe("compressedName", () => {
  it("rend toujours un .mp4", () => {
    expect(compressedName("master260420.mov")).toBe("master260420.mp4");
    expect(compressedName("reel.final.mp4")).toBe("reel.final.mp4");
    expect(compressedName("sans-extension")).toBe("sans-extension.mp4");
  });
});
