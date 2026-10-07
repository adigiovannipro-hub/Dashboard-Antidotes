// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La route du connecteur, sans base ni secret réel : la clé et les outils sont
 * remplacés, la logique d'accès est celle de production. Ce qu'on vérifie,
 * c'est que `lire_visuels` est gardé par la même porte que les autres outils.
 */

const KEY = "k".repeat(48);
const calls: string[] = [];

vi.mock("@/lib/env", () => ({
  missingServerEnv: () => (process.env.MCP_SECRET ? [] : ["MCP_SECRET"]),
  serverEnv: () => ({ MCP_SECRET: process.env.MCP_SECRET }),
}));

vi.mock("@/lib/mcp/tools", () => ({
  MCP_TOOLS: [
    {
      name: "lire_visuels",
      description: "Les visuels.",
      inputSchema: {
        type: "object",
        properties: { publication_id: { type: "string", description: "Id." } },
        required: ["publication_id"],
      },
      readOnly: true,
      run: async () => {
        calls.push("lire_visuels");
        return {
          text: "visuel 1 · image",
          content: [
            { type: "text", text: "visuel 1 · image" },
            { type: "image", data: "/9j/AA==", mimeType: "image/jpeg" },
          ],
        };
      },
    },
  ],
}));

const call = (key: string, body: unknown) =>
  import("./route").then(({ POST }) =>
    POST(new Request(`https://app.antidotes.agency/api/mcp/${key}`, { method: "POST", body: JSON.stringify(body) }), {
      params: Promise.resolve({ cle: key }),
    }),
  );

const visualsCall = {
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: { name: "lire_visuels", arguments: { publication_id: "p1" } },
};

describe("POST /api/mcp/[cle]", () => {
  const previous = process.env.MCP_SECRET;

  beforeEach(() => {
    calls.length = 0;
    process.env.MCP_SECRET = KEY;
  });

  afterAll(() => {
    if (previous === undefined) delete process.env.MCP_SECRET;
    else process.env.MCP_SECRET = previous;
  });

  it("refuse lire_visuels à une clé qui n'est pas la bonne, sans appeler l'outil", async () => {
    const response = await call("x".repeat(48), visualsCall);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(calls).toEqual([]);
  });

  it("refuse une clé de longueur différente", async () => {
    const response = await call(KEY.slice(1), visualsCall);
    expect(response.status).toBe(404);
    expect(calls).toEqual([]);
  });

  it("refuse tout tant que la clé n'est pas configurée", async () => {
    delete process.env.MCP_SECRET;
    const response = await call(KEY, visualsCall);
    expect(response.status).toBe(404);
    expect(calls).toEqual([]);
  });

  it("sert lire_visuels avec la clé en place, blocs image compris", async () => {
    const response = await call(KEY, visualsCall);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { result: { content: { type: string }[] } };
    expect(body.result.content.map((block) => block.type)).toEqual(["text", "image"]);
    expect(calls).toEqual(["lire_visuels"]);
  });

  it("liste lire_visuels en lecture seule", async () => {
    const response = await call(KEY, { jsonrpc: "2.0", id: 2, method: "tools/list" });
    const body = (await response.json()) as {
      result: { tools: { name: string; annotations: { readOnlyHint: boolean } }[] };
    };
    expect(body.result.tools).toEqual([
      expect.objectContaining({ name: "lire_visuels", annotations: { readOnlyHint: true, destructiveHint: false } }),
    ]);
  });
});
