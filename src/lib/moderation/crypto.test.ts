import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  decryptSecret,
  encryptSecret,
  MAX_WEBHOOK_ATTEMPTS,
  nextRetryDelayMs,
  verifyMetaSignature,
} from "./crypto";

const KEY = Buffer.alloc(32, 7).toString("base64");
let previousKey: string | undefined;

beforeAll(() => {
  previousKey = process.env.CREDENTIALS_ENCRYPTION_KEY;
  process.env.CREDENTIALS_ENCRYPTION_KEY = KEY;
});

afterAll(() => {
  if (previousKey === undefined) delete process.env.CREDENTIALS_ENCRYPTION_KEY;
  else process.env.CREDENTIALS_ENCRYPTION_KEY = previousKey;
});

describe("chiffrement des tokens", () => {
  it("fait un aller-retour fidèle", () => {
    const token = "EAAG…un-token-meta-longue-duree";
    expect(decryptSecret(encryptSecret(token))).toBe(token);
  });

  it("produit un chiffré différent à chaque appel", () => {
    // IV aléatoire : deux comptes avec le même token n'ont pas le même blob,
    // sinon une simple comparaison révélerait qu'ils partagent un accès.
    const a = encryptSecret("meme-token");
    const b = encryptSecret("meme-token");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(decryptSecret(b));
  });

  it("rejette un chiffré altéré au lieu de produire des octets faux", () => {
    const blob = encryptSecret("token");
    const parts = blob.split(".");
    const tampered = Buffer.from(parts[3]!, "base64url");
    tampered[0] ^= 0xff;
    parts[3] = tampered.toString("base64url");

    expect(() => decryptSecret(parts.join("."))).toThrow();
  });

  it("rejette un tag d'authentification altéré", () => {
    const parts = encryptSecret("token").split(".");
    const tag = Buffer.from(parts[2]!, "base64url");
    tag[0] ^= 0xff;
    parts[2] = tag.toString("base64url");

    expect(() => decryptSecret(parts.join("."))).toThrow();
  });

  it("refuse un format inconnu", () => {
    expect(() => decryptSecret("pas-un-blob")).toThrow(/non reconnu/);
  });

  it("refuse une clé de mauvaise taille", () => {
    const saved = process.env.CREDENTIALS_ENCRYPTION_KEY;
    process.env.CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(16).toString("base64");
    expect(() => encryptSecret("x")).toThrow(/32 octets/);
    process.env.CREDENTIALS_ENCRYPTION_KEY = saved;
  });
});

describe("vérification de signature webhook", () => {
  const APP_SECRET = "app-secret-de-test";
  const BODY = JSON.stringify({ object: "instagram", entry: [] });

  function sign(body: string, secret = APP_SECRET): string {
    return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
  }

  it("accepte une signature valide", () => {
    expect(
      verifyMetaSignature({
        rawBody: BODY,
        header: sign(BODY),
        appSecret: APP_SECRET,
      }),
    ).toBe(true);
  });

  it("refuse une signature produite avec un autre secret", () => {
    expect(
      verifyMetaSignature({
        rawBody: BODY,
        header: sign(BODY, "mauvais-secret"),
        appSecret: APP_SECRET,
      }),
    ).toBe(false);
  });

  it("refuse quand le corps a été modifié après signature", () => {
    const header = sign(BODY);
    expect(
      verifyMetaSignature({
        rawBody: BODY.replace("instagram", "facebook"),
        header,
        appSecret: APP_SECRET,
      }),
    ).toBe(false);
  });

  it("refuse un en-tête absent ou mal formé", () => {
    expect(
      verifyMetaSignature({ rawBody: BODY, header: null, appSecret: APP_SECRET }),
    ).toBe(false);
    expect(
      verifyMetaSignature({ rawBody: BODY, header: "abc123", appSecret: APP_SECRET }),
    ).toBe(false);
  });

  it("refuse une signature de longueur incorrecte sans lever", () => {
    // `timingSafeEqual` lève sur des tailles différentes : on doit court-circuiter.
    expect(
      verifyMetaSignature({
        rawBody: BODY,
        header: "sha256=aabb",
        appSecret: APP_SECRET,
      }),
    ).toBe(false);
  });
});

describe("file de reprise", () => {
  it("espace les tentatives de façon exponentielle", () => {
    const first = nextRetryDelayMs(1);
    const third = nextRetryDelayMs(3);
    expect(third).toBeGreaterThan(first);
  });

  it("plafonne à une heure", () => {
    // Sans plafond, la douzième tentative attendrait plus d'un an.
    expect(nextRetryDelayMs(30)).toBeLessThanOrEqual(60 * 60 * 1000 * 1.2);
  });

  it("ajoute une gigue pour ne pas relancer tout le monde en même temps", () => {
    const delays = new Set(
      Array.from({ length: 20 }, () => nextRetryDelayMs(5)),
    );
    expect(delays.size).toBeGreaterThan(1);
  });

  it("borne le nombre de tentatives", () => {
    expect(MAX_WEBHOOK_ATTEMPTS).toBeGreaterThan(3);
    expect(MAX_WEBHOOK_ATTEMPTS).toBeLessThan(20);
  });
});
