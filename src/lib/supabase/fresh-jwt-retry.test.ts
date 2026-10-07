import { describe, expect, it } from "vitest";

import {
  bearerIssuedAt,
  isClaimsRejection,
  isFreshToken,
  withFreshJwtRetry,
} from "./fresh-jwt-retry";

const NOW = Date.UTC(2026, 9, 7, 3, 44, 1);

const jwt = (iat: number) =>
  [
    Buffer.from(JSON.stringify({ alg: "ES256" })).toString("base64url"),
    Buffer.from(JSON.stringify({ iat, sub: "u" })).toString("base64url"),
    "signature",
  ].join(".");

const withBearer = (token: string): RequestInit => ({
  headers: new Headers({ Authorization: `Bearer ${token}` }),
});

const ok = () => new Response("[]", { status: 200 });
const claimsRejected = () =>
  new Response(JSON.stringify({ code: "PGRST303", message: "JWT issued at future" }), {
    status: 401,
    headers: { "proxy-status": "PostgREST; error=PGRST303" },
  });

/** Un fetch qui rend les réponses dans l'ordre et compte ses appels. */
const scripted = (...responses: (() => Response)[]) => {
  let calls = 0;
  const fetchImpl = async () => responses[Math.min(calls++, responses.length - 1)]();
  return { fetchImpl, calls: () => calls };
};

const options = { delays: [1_000, 2_000, 3_000], sleep: async () => {}, now: () => NOW };

describe("bearerIssuedAt", () => {
  it("lit la date d'émission du jeton porté par la requête", () => {
    expect(bearerIssuedAt(withBearer(jwt(1791344639)))).toBe(1791344639);
  });

  it("rend null sans jeton ou sur un jeton illisible", () => {
    expect(bearerIssuedAt({})).toBeNull();
    expect(bearerIssuedAt(withBearer("pas-un-jeton"))).toBeNull();
  });
});

describe("isFreshToken", () => {
  it("tient pour frais un jeton de deux secondes, ou daté du futur", () => {
    expect(isFreshToken(NOW / 1000 - 2, NOW)).toBe(true);
    expect(isFreshToken(NOW / 1000 + 3, NOW)).toBe(true);
  });

  it("ne tient pas pour frais un jeton de plus d'une minute", () => {
    expect(isFreshToken(NOW / 1000 - 120, NOW)).toBe(false);
    expect(isFreshToken(null, NOW)).toBe(false);
  });
});

describe("isClaimsRejection", () => {
  it("reconnaît le refus PGRST303 par l'en-tête ou par le corps", async () => {
    expect(await isClaimsRejection(claimsRejected())).toBe(true);
    expect(
      await isClaimsRejection(
        new Response(JSON.stringify({ code: "PGRST303" }), { status: 401 }),
      ),
    ).toBe(true);
  });

  it("ne confond pas un autre 401 ni un succès", async () => {
    expect(
      await isClaimsRejection(
        new Response(JSON.stringify({ code: "42501" }), { status: 401 }),
      ),
    ).toBe(false);
    expect(await isClaimsRejection(ok())).toBe(false);
  });
});

describe("withFreshJwtRetry", () => {
  it("rend une réponse réussie au premier essai", async () => {
    const { fetchImpl, calls } = scripted(ok);
    const response = await withFreshJwtRetry(fetchImpl, options)(
      "https://x/rest/v1/workspaces",
      withBearer(jwt(NOW / 1000 - 2)),
    );
    expect(response.status).toBe(200);
    expect(calls()).toBe(1);
  });

  it("rejoue le refus d'un jeton tout juste émis jusqu'à ce qu'il passe", async () => {
    const { fetchImpl, calls } = scripted(claimsRejected, claimsRejected, ok);
    const response = await withFreshJwtRetry(fetchImpl, options)(
      "https://x/rest/v1/workspaces",
      withBearer(jwt(NOW / 1000 - 2)),
    );
    expect(response.status).toBe(200);
    expect(calls()).toBe(3);
  });

  it("abandonne après la dernière attente et rend le refus", async () => {
    const { fetchImpl, calls } = scripted(claimsRejected);
    const response = await withFreshJwtRetry(fetchImpl, options)(
      "https://x/rest/v1/workspaces",
      withBearer(jwt(NOW / 1000 - 2)),
    );
    expect(response.status).toBe(401);
    expect(calls()).toBe(4);
  });

  it("ne rejoue pas le refus d'un jeton ancien : attendre ne le rendra pas valide", async () => {
    const { fetchImpl, calls } = scripted(claimsRejected, ok);
    const response = await withFreshJwtRetry(fetchImpl, options)(
      "https://x/rest/v1/workspaces",
      withBearer(jwt(NOW / 1000 - 3_600)),
    );
    expect(response.status).toBe(401);
    expect(calls()).toBe(1);
  });

  it("ne rejoue pas un autre 401", async () => {
    const { fetchImpl, calls } = scripted(
      () => new Response(JSON.stringify({ code: "42501" }), { status: 401 }),
      ok,
    );
    await withFreshJwtRetry(fetchImpl, options)(
      "https://x/rest/v1/workspaces",
      withBearer(jwt(NOW / 1000 - 2)),
    );
    expect(calls()).toBe(1);
  });

  it("rejoue une écriture dont le corps est une chaîne", async () => {
    const { fetchImpl, calls } = scripted(claimsRejected, ok);
    const init = { ...withBearer(jwt(NOW / 1000 - 2)), method: "POST", body: '{"a":1}' };
    const response = await withFreshJwtRetry(fetchImpl, options)(
      "https://x/rest/v1/work_tasks",
      init,
    );
    expect(response.status).toBe(200);
    expect(calls()).toBe(2);
  });

  it("ne rejoue pas une requête dont le corps est un flux", async () => {
    const { fetchImpl, calls } = scripted(claimsRejected, ok);
    const init = {
      ...withBearer(jwt(NOW / 1000 - 2)),
      method: "POST",
      body: new ReadableStream<Uint8Array>(),
    };
    await withFreshJwtRetry(fetchImpl, options)("https://x/storage/v1/object", init);
    expect(calls()).toBe(1);
  });
});
