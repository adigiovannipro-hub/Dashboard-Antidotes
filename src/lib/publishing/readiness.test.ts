import { describe, expect, it } from "vitest";

import {
  isPublishWindow,
  isVideoPath,
  parisStamp,
  publishPlan,
  publishTargets,
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

  it("les autres réseaux ne partent pas automatiquement", () => {
    expect(publishTargets("linkedin")).toEqual([]);
    expect(publishTargets("tiktok")).toEqual([]);
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

  it("plafonne le carrousel à 10 — la limite Meta", () => {
    const eleven = Array.from({ length: 11 }, (_, index) => `v${index}.jpg`);
    const plan = publishPlan(subject({ visual_urls: eleven }));
    expect(plan).toEqual({ ready: false, blockers: ["carrousel-trop-long"] });
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
