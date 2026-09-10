import { describe, expect, it } from "vitest";

import { canonicalUrl, isCompanyUrl, parseAccountUrl } from "./account-url";

describe("parseAccountUrl", () => {
  it("reconnaît un profil LinkedIn et en tire le pseudo", () => {
    expect(parseAccountUrl("https://www.linkedin.com/in/alessandro-digiovanni/")).toEqual({
      platform: "linkedin",
      handle: "alessandro-digiovanni",
      url: "https://www.linkedin.com/in/alessandro-digiovanni",
    });
  });

  it("accepte une adresse sans protocole", () => {
    expect(parseAccountUrl("instagram.com/anmf")?.platform).toBe("instagram");
  });

  it("ignore la sous-locale de LinkedIn", () => {
    expect(parseAccountUrl("https://fr.linkedin.com/in/moi")?.handle).toBe("moi");
  });

  it("range une page d'entreprise sur le bon réseau", () => {
    const page = parseAccountUrl("https://www.linkedin.com/company/antidotes/");
    expect(page?.platform).toBe("linkedin");
    expect(page?.handle).toBe("antidotes");
  });

  it("retire l'arobase d'une chaîne YouTube ou TikTok", () => {
    expect(parseAccountUrl("https://www.youtube.com/@lachaine")?.handle).toBe("lachaine");
    expect(parseAccountUrl("https://www.tiktok.com/@lecompte?lang=fr")?.handle).toBe("lecompte");
  });

  it("ne garde pas le segment technique d'une URL de chaîne", () => {
    expect(parseAccountUrl("https://youtube.com/channel/UC123")?.handle).toBe("UC123");
  });

  it("range twitter.com sur X", () => {
    expect(parseAccountUrl("https://twitter.com/quelquun")).toEqual({
      platform: "x",
      handle: "quelquun",
      url: "https://x.com/quelquun",
    });
  });

  it("laisse tomber les paramètres de suivi de l'application mobile", () => {
    expect(parseAccountUrl("https://www.instagram.com/anmf/?igsh=abc&utm_source=ig")?.url).toBe(
      "https://www.instagram.com/anmf",
    );
  });

  it("ne devine rien d'un domaine inconnu ou d'un pseudo seul", () => {
    expect(parseAccountUrl("https://exemple.fr/moi")).toBeNull();
    expect(parseAccountUrl("@moi")).toBeNull();
    expect(parseAccountUrl("   ")).toBeNull();
  });

  it("ne rend rien quand le domaine est reconnu mais le chemin vide", () => {
    expect(parseAccountUrl("https://www.linkedin.com/")).toBeNull();
  });
});

describe("canonicalUrl", () => {
  it("reconstruit une adresse propre pour chaque réseau", () => {
    expect(canonicalUrl("youtube", "@chaine")).toBe("https://www.youtube.com/@chaine");
    expect(canonicalUrl("x", "moi")).toBe("https://x.com/moi");
  });
});

describe("isCompanyUrl", () => {
  it("distingue une page d'entreprise d'un profil", () => {
    expect(isCompanyUrl("https://www.linkedin.com/company/antidotes")).toBe(true);
    expect(isCompanyUrl("https://www.linkedin.com/in/moi")).toBe(false);
  });
});
