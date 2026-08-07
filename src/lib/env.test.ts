import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { missingServerEnv } from "./env";

/**
 * `missingServerEnv` existe pour qu'une configuration incomplète se lise dans
 * la réponse d'un cron plutôt que dans un 500 au corps vide. Le tester revient
 * donc à vérifier qu'elle nomme exactement ce qui manque.
 */
describe("missingServerEnv", () => {
  const KEYS = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "CREDENTIALS_ENCRYPTION_KEY",
    "CRON_SECRET",
  ] as const;

  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of KEYS) {
      saved[key] = process.env[key];
      process.env[key] = `valeur-${key}`;
    }
  });

  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("ne rend rien quand tout est présent", () => {
    expect(missingServerEnv()).toEqual([]);
  });

  it("nomme la variable absente", () => {
    delete process.env.CRON_SECRET;
    expect(missingServerEnv()).toEqual(["CRON_SECRET"]);
  });

  it("traite une valeur vide comme absente — le cas d'un champ créé sans valeur", () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = "";
    expect(missingServerEnv()).toEqual(["CREDENTIALS_ENCRYPTION_KEY"]);
  });

  it("les nomme toutes plutôt que de s'arrêter à la première", () => {
    delete process.env.CRON_SECRET;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    expect(missingServerEnv().sort()).toEqual([
      "CRON_SECRET",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]);
  });
});
