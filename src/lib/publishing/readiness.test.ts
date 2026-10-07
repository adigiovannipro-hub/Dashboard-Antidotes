import { describe, expect, it } from "vitest";

import {
  isPublishWindow,
  isJpegPath,
  isPdfPath,
  isVideoPath,
  parisStamp,
  publishPlan,
  publishTargets,
  targetPlan,
} from "./readiness";

const subject = (over: Partial<Parameters<typeof publishPlan>[0]> = {}) => ({
  format: "post",
  wording: "Une belle accroche prête à partir.",
  visual_urls: ["bondet/visuel.jpg"],
  ...over,
});

describe("publishTargets", () => {
  it("META couvre les deux réseaux, c'est sa définition côté board", () => {
    expect(publishTargets("meta")).toEqual(["instagram", "facebook"]);
    expect(publishTargets("instagram")).toEqual(["instagram"]);
    expect(publishTargets("facebook")).toEqual(["facebook"]);
  });

  it("TikTok et LinkedIn ont chacun leur cible", () => {
    expect(publishTargets("linkedin")).toEqual(["linkedin"]);
    expect(publishTargets("tiktok")).toEqual(["tiktok"]);
  });

  it("les autres réseaux ne partent pas automatiquement", () => {
    expect(publishTargets("x")).toEqual([]);
    expect(publishTargets("youtube")).toEqual([]);
    expect(publishTargets("other")).toEqual([]);
  });
});

describe("publishPlan", () => {
  it("une story est exclue, pas bloquée — elle se publie à la main", () => {
    expect(publishPlan(subject({ format: "story" }))).toEqual({
      ready: false,
      story: true,
    });
  });

  it("bloque sans visuel et sans wording, avec toutes les causes", () => {
    const plan = publishPlan(subject({ wording: "  ", visual_urls: [] }));
    expect(plan).toEqual({
      ready: false,
      blockers: ["sans-visuel", "sans-wording"],
    });
  });

  it("un wording en placeholder n'est pas un wording", () => {
    expect(publishPlan(subject({ wording: "—" })).ready).toBe(false);
    expect(publishPlan(subject({ wording: "WORDING À FAIRE" })).ready).toBe(false);
  });

  it("un reel exige un fichier vidéo", () => {
    const plan = publishPlan(
      subject({ format: "reel", visual_urls: ["bondet/image.jpg"] }),
    );
    expect(plan).toEqual({ ready: false, blockers: ["reel-sans-video"] });
  });

  it("déduit la forme des fichiers : deux visuels font un carrousel", () => {
    expect(publishPlan(subject({ visual_urls: ["a.jpg", "b.jpg"] }))).toEqual({
      ready: true,
      shape: "carousel",
    });
    expect(
      publishPlan(subject({ format: "reel", visual_urls: ["clip.mp4"] })),
    ).toEqual({ ready: true, shape: "video" });
    expect(publishPlan(subject())).toEqual({ ready: true, shape: "image" });
  });

  it("un PDF seul est un document", () => {
    expect(publishPlan(subject({ visual_urls: ["deck.pdf"] }))).toEqual({
      ready: true,
      shape: "document",
    });
  });
});

describe("targetPlan", () => {
  const eleven = Array.from({ length: 11 }, (_, index) => `v${index}.png`);

  it("plafonne le carrousel à 10 sur Meta, pas sur LinkedIn", () => {
    const long = subject({ visual_urls: eleven });
    expect(targetPlan("instagram", long)).toEqual({
      ready: false,
      blockers: ["carrousel-trop-long"],
    });
    expect(targetPlan("facebook", long)).toEqual({
      ready: false,
      blockers: ["carrousel-trop-long"],
    });
    expect(targetPlan("linkedin", long)).toEqual({ ready: true, shape: "document" });
  });

  it("un carrousel d'images part en PDF sur LinkedIn", () => {
    const carousel = subject({ visual_urls: ["a.png", "b.png", "c.png"] });
    expect(targetPlan("instagram", carousel)).toEqual({ ready: true, shape: "carousel" });
    expect(targetPlan("linkedin", carousel)).toEqual({ ready: true, shape: "document" });
  });

  it("Facebook refuse un carrousel qui contient une vidéo, Instagram non", () => {
    const mixed = subject({ visual_urls: ["a.jpg", "clip.mp4"] });
    expect(targetPlan("instagram", mixed).ready).toBe(true);
    expect(targetPlan("facebook", mixed)).toEqual({
      ready: false,
      blockers: ["facebook-carrousel-video"],
    });
  });

  it("le brouillon TikTok ne prend qu'une vidéo seule", () => {
    expect(
      targetPlan("tiktok", subject({ format: "reel", visual_urls: ["clip.MOV"] })),
    ).toEqual({ ready: true, shape: "video" });
    expect(targetPlan("tiktok", subject({ visual_urls: ["a.png", "b.png"] }))).toEqual({
      ready: false,
      blockers: ["tiktok-video-seule"],
    });
    expect(targetPlan("tiktok", subject()).ready).toBe(false);
  });

  it("LinkedIn ne mêle pas vidéo ou PDF à d'autres visuels", () => {
    expect(targetPlan("linkedin", subject({ visual_urls: ["clip.mp4", "a.png"] }))).toEqual({
      ready: false,
      blockers: ["linkedin-melange"],
    });
    expect(targetPlan("linkedin", subject({ visual_urls: ["deck.pdf", "a.png"] }))).toEqual({
      ready: false,
      blockers: ["linkedin-melange"],
    });
    expect(targetPlan("linkedin", subject({ visual_urls: ["deck.pdf"] }))).toEqual({
      ready: true,
      shape: "document",
    });
    expect(targetPlan("linkedin", subject({ visual_urls: ["clip.mp4"] }))).toEqual({
      ready: true,
      shape: "video",
    });
  });

  it("un PDF ne part que sur LinkedIn", () => {
    const pdf = subject({ visual_urls: ["deck.pdf"] });
    expect(targetPlan("instagram", pdf)).toEqual({
      ready: false,
      blockers: ["pdf-hors-linkedin"],
    });
  });

  it("compte la légende en caractères, emojis compris, au plafond du réseau", () => {
    const at = subject({ wording: "é".repeat(2200) });
    const over = subject({ wording: "🌾".repeat(2201) });
    expect(targetPlan("instagram", at).ready).toBe(true);
    expect(targetPlan("instagram", over)).toEqual({
      ready: false,
      blockers: ["legende-trop-longue"],
    });
    expect(targetPlan("linkedin", over).ready).toBe(true);
    // TikTok ne reçoit pas la légende en brouillon : aucun plafond.
    expect(
      targetPlan("tiktok", subject({ wording: "x".repeat(5000), visual_urls: ["c.mp4"] })).ready,
    ).toBe(true);
  });
});

describe("isPdfPath / isJpegPath", () => {
  it("reconnaissent l'extension, casse et querystring compris", () => {
    expect(isPdfPath("anmf/deck.PDF?token=1")).toBe(true);
    expect(isPdfPath("anmf/deck.png")).toBe(false);
    expect(isJpegPath("anmf/a.JPEG")).toBe(true);
    expect(isJpegPath("anmf/a.jpg?x=1")).toBe(true);
    expect(isJpegPath("anmf/a.png")).toBe(false);
  });
});

describe("isVideoPath", () => {
  it("reconnaît une vidéo à son extension, casse et querystring compris", () => {
    expect(isVideoPath("bondet/clip.MP4")).toBe(true);
    expect(isVideoPath("https://cdn.example/clip.mov?token=abc")).toBe(true);
    expect(isVideoPath("bondet/photo.jpg")).toBe(false);
  });
});

describe("parisStamp", () => {
  it("suit l'heure d'été — 14h UTC est 16h à Paris en août", () => {
    expect(parisStamp(new Date("2026-08-17T14:00:00Z"))).toEqual({
      date: "2026-08-17",
      hour: 16,
    });
  });

  it("suit l'heure d'hiver — 15h UTC est 16h à Paris en janvier", () => {
    expect(parisStamp(new Date("2026-01-15T15:00:00Z"))).toEqual({
      date: "2026-01-15",
      hour: 16,
    });
  });

  it("change de jour à minuit de Paris, pas de Greenwich", () => {
    expect(parisStamp(new Date("2026-08-17T22:30:00Z"))).toEqual({
      date: "2026-08-18",
      hour: 0,
    });
  });
});

describe("isPublishWindow", () => {
  it("refuse le matin — rien ne part avant 16h", () => {
    expect(isPublishWindow(9)).toBe(false);
    expect(isPublishWindow(15)).toBe(false);
  });

  it("ouvre à 16h pile", () => {
    expect(isPublishWindow(16)).toBe(true);
  });

  it("laisse rattraper toute la soirée — c'est là qu'est la correction", () => {
    // Une seule chance par jour, c'était une chance sur deux de ne rien
    // publier : le passage de 14h17 UTC est sauté aussi souvent qu'un autre.
    expect(isPublishWindow(19)).toBe(true);
    expect(isPublishWindow(23)).toBe(true);
  });

  it("se referme à minuit — pas par l'heure, par la date de Paris qui avance", () => {
    expect(isPublishWindow(0)).toBe(false);
  });
});
