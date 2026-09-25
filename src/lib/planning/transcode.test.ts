import { describe, expect, it } from "vitest";

import {
  DEFAULT_VIDEO_KBPS,
  capForUploadLimit,
  isHdr,
  isVideoName,
  parseProbe,
  targetVideoKbps,
  transcodeArgs,
  transcodedName,
  type VideoProbe,
} from "./transcode";

const probe = (overrides: Partial<VideoProbe> = {}): VideoProbe => ({
  durationSeconds: 30,
  hasAudio: true,
  colorTransfer: "bt709",
  ...overrides,
});

describe("targetVideoKbps", () => {
  it("rend le plafond par défaut sans budget", () => {
    expect(targetVideoKbps({ totalSeconds: 600, budgetBytes: null })).toBe(DEFAULT_VIDEO_KBPS);
  });

  it("répartit le budget sur la durée totale, son déduit", () => {
    // 100 Mo sur 1 000 s = 800 kbit/s au total, dont 96 de son.
    expect(targetVideoKbps({ totalSeconds: 1000, budgetBytes: 100_000_000 })).toBe(704);
  });

  it("ne descend jamais sous 500 kbit/s ni ne dépasse le plafond", () => {
    expect(targetVideoKbps({ totalSeconds: 10_000, budgetBytes: 10_000_000 })).toBe(500);
    expect(targetVideoKbps({ totalSeconds: 10, budgetBytes: 500_000_000 })).toBe(DEFAULT_VIDEO_KBPS);
  });
});

describe("capForUploadLimit", () => {
  it("laisse passer une vidéo courte", () => {
    expect(capForUploadLimit(1200, 60)).toBe(1200);
  });

  it("baisse le débit d'une vidéo longue sous le plafond de 50 Mo", () => {
    const kbps = capForUploadLimit(1200, 600);
    const bytes = ((kbps + 96) * 1000 * 600) / 8;
    expect(bytes).toBeLessThan(50 * 1024 * 1024);
  });
});

describe("isHdr", () => {
  it("reconnaît le HLG d'un iPhone et le PQ", () => {
    expect(isHdr(probe({ colorTransfer: "arib-std-b67" }))).toBe(true);
    expect(isHdr(probe({ colorTransfer: "smpte2084" }))).toBe(true);
    expect(isHdr(probe())).toBe(false);
    expect(isHdr(probe({ colorTransfer: null }))).toBe(false);
  });
});

describe("transcodeArgs", () => {
  it("encode en H.264 720p sous plafond, son AAC, démarrage rapide", () => {
    const args = transcodeArgs({ source: "in.mov", output: "out.mp4", probe: probe(), videoKbps: 900 });
    const joined = args.join(" ");

    expect(joined).toContain("-i in.mov");
    expect(joined).toContain("-c:v libx264");
    expect(joined).toContain("-maxrate 900k");
    expect(joined).toContain("-c:a aac");
    expect(joined).toContain("+faststart");
    expect(joined).toContain("min(720,iw)");
    expect(args.at(-1)).toBe("out.mp4");
  });

  it("ramène le HDR en SDR avant de mettre à l'échelle", () => {
    const args = transcodeArgs({
      source: "in.mov",
      output: "out.mp4",
      probe: probe({ colorTransfer: "arib-std-b67" }),
      videoKbps: 900,
    });
    const filters = args[args.indexOf("-vf") + 1]!;
    expect(filters.indexOf("tonemap")).toBeGreaterThan(-1);
    expect(filters.indexOf("tonemap")).toBeLessThan(filters.indexOf("scale=w="));
  });

  it("n'ajoute pas de piste son à une vidéo muette", () => {
    const args = transcodeArgs({
      source: "in.mp4",
      output: "out.mp4",
      probe: probe({ hasAudio: false }),
      videoKbps: 900,
    });
    expect(args).toContain("-an");
    expect(args).not.toContain("0:a:0");
  });
});

describe("parseProbe", () => {
  it("lit durée, son et transfert de couleur", () => {
    const json = JSON.stringify({
      streams: [
        { codec_type: "video", color_transfer: "arib-std-b67" },
        { codec_type: "audio" },
      ],
      format: { duration: "31.46" },
    });
    expect(parseProbe(json)).toEqual({
      durationSeconds: 31.46,
      hasAudio: true,
      colorTransfer: "arib-std-b67",
    });
  });

  it("tolère une sortie sans durée", () => {
    expect(parseProbe("{}")).toEqual({ durationSeconds: 0, hasAudio: false, colorTransfer: null });
  });
});

describe("transcodedName", () => {
  it("remplace l'extension par .mp4", () => {
    expect(transcodedName("CAPSULE 1.mov")).toBe("CAPSULE 1.mp4");
    expect(transcodedName("sans-extension")).toBe("sans-extension.mp4");
  });
});

describe("isVideoName", () => {
  it("reconnaît les vidéos à leur extension", () => {
    expect(isVideoName("a.MOV")).toBe(true);
    expect(isVideoName("a.mp4")).toBe(true);
    expect(isVideoName("a.png")).toBe(false);
  });
});
