import { describe, expect, it } from "vitest";

import { DEFAULT_PROMPTS, INBOUND_FORMATS, parseFormat, resolvePrompt } from "./prompts";
import type { InboundSettings } from "../types";

const settings = (over: Partial<InboundSettings> = {}): InboundSettings => ({
  org_id: "org",
  guidelines: null,
  linkedin_example: null,
  reel_example: null,
  email_example: null,
  thresholds: {},
  prompts: {},
  updated_at: "2026-09-12T00:00:00.000Z",
  ...over,
});

describe("resolvePrompt", () => {
  it("retombe sur le prompt du code quand rien n'est écrit", () => {
    const resolved = resolvePrompt(null, "reel_script");
    expect(resolved.system).toBe(DEFAULT_PROMPTS.reel_script);
    expect(resolved.custom).toBe(false);
  });

  it("préfère le prompt écrit à l'écran", () => {
    const resolved = resolvePrompt(
      settings({ prompts: { linkedin_post: { prompt: "Écris court." } } }),
      "linkedin_post",
    );
    expect(resolved.system).toBe("Écris court.");
    expect(resolved.custom).toBe(true);
  });

  it("traite un champ vide comme une absence de retouche, pas comme une consigne vide", () => {
    const resolved = resolvePrompt(
      settings({ prompts: { linkedin_post: { prompt: "   " } } }),
      "linkedin_post",
    );
    expect(resolved.system).toBe(DEFAULT_PROMPTS.linkedin_post);
    expect(resolved.custom).toBe(false);
  });

  it("garde l'exemple saisi avant la fenêtre Prompts", () => {
    expect(resolvePrompt(settings({ reel_example: "ACCROCHE (3 s) : …" }), "reel_script").example).toBe(
      "ACCROCHE (3 s) : …",
    );
  });

  it("le nouvel exemple prime sur l'ancien", () => {
    const resolved = resolvePrompt(
      settings({ reel_example: "ancien", prompts: { reel_script: { example: "nouveau" } } }),
      "reel_script",
    );
    expect(resolved.example).toBe("nouveau");
  });

  it("n'invente pas d'exemple pour le format YouTube", () => {
    expect(resolvePrompt(settings({ linkedin_example: "post" }), "youtube_script").example).toBeNull();
  });
});

describe("parseFormat", () => {
  it("accepte les trois formes et rien d'autre", () => {
    for (const format of INBOUND_FORMATS) expect(parseFormat(format)).toBe(format);
    expect(parseFormat("email")).toBeNull();
    expect(parseFormat(undefined)).toBeNull();
  });
});
