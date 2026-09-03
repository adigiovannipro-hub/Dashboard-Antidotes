// @vitest-environment node
//
// La suite tourne par défaut sous jsdom, où `window` existe : `serverEnv()`
// s'y refuse par conception, pour ne jamais embarquer la clé `service_role`
// dans un bundle navigateur. Ces cas veulent le comportement serveur.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { missingServerEnv, serverEnv } from "./env";

/**
 * Ces deux fonctions existent pour qu'une configuration incomplète se lise
 * dans la réponse d'un cron plutôt que dans un 500 au corps vide — et pour
 * qu'un chemin ne dépende que des secrets qu'il utilise réellement.
 */
const KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "CREDENTIALS_ENCRYPTION_KEY",
  "CRON_SECRET",
  "GITHUB_SYNC_TOKEN",
  "COMPOSIO_API_KEY",
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

describe("missingServerEnv", () => {
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

  it("ignore ce qu'on ne lui demande pas de vérifier", () => {
    // Le cas qui a bloqué la synchronisation Airwallex : une clé absente,
    // mais sans rapport avec le chemin appelé.
    delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    expect(missingServerEnv("CRON_SECRET", "SUPABASE_SERVICE_ROLE_KEY")).toEqual(
      [],
    );
  });
});

describe("serverEnv", () => {
  it("ne rend que les secrets demandés", () => {
    expect(serverEnv("CRON_SECRET")).toEqual({
      CRON_SECRET: "valeur-CRON_SECRET",
    });
  });

  it("n'exige pas les secrets qu'on ne lui demande pas", () => {
    delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    expect(() => serverEnv("CRON_SECRET")).not.toThrow();
  });

  it("lève en nommant ce qui manque parmi les secrets demandés", () => {
    delete process.env.CRON_SECRET;
    expect(() => serverEnv("CRON_SECRET")).toThrow(/CRON_SECRET/);
  });
});
