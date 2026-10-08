import { describe, expect, it } from "vitest";

import {
  isDueNow,
  isPublishWindow,
  isJpegPath,
  isPdfPath,
  openingInParis,
  publishOpening,
  isVideoPath,
  parisStamp,
  publishPlan,
  PUBLISH_TRIGGER_STATUS,
  PUBLISHABLE_NOW_STATUSES,
  publishNetworksLabel,
  publishTargets,
  schedulingProblem,
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

describe("publishOpening", () => {
  it("ouvre à 16h00 à Bali, soit 08h00 UTC toute l'année", () => {
    expect(publishOpening("2026-10-09").toISOString()).toBe("2026-10-09T08:00:00.000Z");
    expect(publishOpening("2026-12-01").toISOString()).toBe("2026-12-01T08:00:00.000Z");
  });

  it("se lit 10h à Paris l'été et 9h l'hiver", () => {
    expect(openingInParis("2026-10-09")).toBe("10h00");
    expect(openingInParis("2026-12-01")).toBe("9h00");
  });
});

describe("isPublishWindow", () => {
  it("reste fermée avant 16h00 à Bali", () => {
    expect(isPublishWindow(new Date("2026-10-09T07:59:00Z"))).toBe(false);
  });

  it("ouvre à 16h00 pile à Bali", () => {
    expect(isPublishWindow(new Date("2026-10-09T08:00:00Z"))).toBe(true);
    expect(isPublishWindow(new Date("2026-12-01T08:00:00Z"))).toBe(true);
  });

  it("laisse rattraper jusqu'à minuit à Paris — c'est là que sont les filets", () => {
    expect(isPublishWindow(new Date("2026-10-09T21:30:00Z"))).toBe(true);
  });

  it("se referme à minuit de Paris : la date de la ligne est française", () => {
    // 00h30 à Paris le 10 : la journée du 10 n'est pas encore ouverte.
    expect(isPublishWindow(new Date("2026-10-09T22:30:00Z"))).toBe(false);
  });
});

describe("PUBLISH_TRIGGER_STATUS", () => {
  it("« Programmé » publie, « Validé » non — c'est l'accord du client", () => {
    expect(PUBLISH_TRIGGER_STATUS).toBe("scheduled");
    expect(PUBLISHABLE_NOW_STATUSES).toContain("scheduled");
    // Le geste manuel de l'agence vaut aussi pour une ligne seulement validée.
    expect(PUBLISHABLE_NOW_STATUSES).toContain("validated");
  });
});

describe("isDueNow", () => {
  // 18h10 à Bali, 12h10 à Paris le 8 octobre : la fenêtre du jour est ouverte.
  const afterOpening = new Date("2026-10-08T10:10:00Z");
  const line = (scheduled_on: string | null, status = "scheduled") => ({ status, scheduled_on });

  it("part : programmée pour aujourd'hui, armée après 16h00 à Bali", () => {
    expect(isDueNow(line("2026-10-08"), afterOpening)).toBe(true);
  });

  it("attend : datée de demain, ou avant 16h00 à Bali", () => {
    expect(isDueNow(line("2026-10-09"), afterOpening)).toBe(false);
    expect(isDueNow(line("2026-10-08"), new Date("2026-10-08T07:30:00Z"))).toBe(false);
  });

  it("ne rattrape pas une date passée : c'est refusé à l'écran", () => {
    expect(isDueNow(line("2026-10-07"), afterOpening)).toBe(false);
  });

  it("« Validé » ne part pas, ni une ligne sans date", () => {
    expect(isDueNow(line("2026-10-08", "validated"), afterOpening)).toBe(false);
    expect(isDueNow(line(null), afterOpening)).toBe(false);
  });
});

describe("schedulingProblem", () => {
  const now = new Date("2026-10-08T10:10:00Z");
  it("passée, sans date, ou rien", () => {
    expect(schedulingProblem({ scheduled_on: "2026-10-07" }, now)).toBe("past");
    expect(schedulingProblem({ scheduled_on: null }, now)).toBe("no_date");
    expect(schedulingProblem({ scheduled_on: "2026-10-08" }, now)).toBeNull();
  });
});

describe("publishNetworksLabel", () => {
  it("nomme les réseaux d'un couloir, ou rien", () => {
    expect(publishNetworksLabel("meta")).toBe("Instagram et Facebook");
    expect(publishNetworksLabel("tiktok")).toBe("TikTok");
    expect(publishNetworksLabel("youtube")).toBeNull();
  });
});
