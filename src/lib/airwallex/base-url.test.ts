// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { baseUrl } from "./base-url";

/**
 * L'adresse de l'API a coûté un premier appel réel : `api.sandbox.airwallex.com`
 * n'existe pas, et la page HTML « 403 Forbidden » qu'il rendait ressemblait à
 * un refus d'authentification.
 */
describe("baseUrl", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ["AIRWALLEX_ENV", "AIRWALLEX_BASE_URL"]) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ["AIRWALLEX_ENV", "AIRWALLEX_BASE_URL"]) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("vise le bac à sable par défaut — une chaîne comptable ne s'essaie pas en production", () => {
    expect(baseUrl()).toBe("https://api-demo.airwallex.com");
  });

  it("vise la production quand on le demande explicitement", () => {
    process.env.AIRWALLEX_ENV = "production";
    expect(baseUrl()).toBe("https://api.airwallex.com");
  });

  it("laisse une adresse explicite l'emporter, sans redéploiement", () => {
    process.env.AIRWALLEX_ENV = "production";
    process.env.AIRWALLEX_BASE_URL = "https://api-demo.airwallex.com";
    expect(baseUrl()).toBe("https://api-demo.airwallex.com");
  });

  it("retire la barre oblique finale d'une adresse collée", () => {
    process.env.AIRWALLEX_BASE_URL = "https://api.airwallex.com/";
    expect(baseUrl()).toBe("https://api.airwallex.com");
  });

  it("ignore une adresse vide plutôt que de viser une chaîne vide", () => {
    process.env.AIRWALLEX_BASE_URL = "   ";
    expect(baseUrl()).toBe("https://api-demo.airwallex.com");
  });
});
