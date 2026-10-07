import { describe, expect, it } from "vitest";

import {
  handleBody,
  handleMessage,
  missingArguments,
  negotiateVersion,
  SUPPORTED_PROTOCOL_VERSIONS,
  type ToolDefinition,
} from "./protocol";

const echo = (overrides: Partial<ToolDefinition> = {}): ToolDefinition => ({
  name: "echo",
  description: "Rend son texte.",
  inputSchema: {
    type: "object",
    properties: { texte: { type: "string", description: "Le texte." } },
    required: ["texte"],
  },
  readOnly: true,
  run: async (args) => ({ text: String(args.texte) }),
  ...overrides,
});

describe("negotiateVersion", () => {
  it("rend la version demandée quand on la parle", () => {
    expect(negotiateVersion("2025-03-26")).toBe("2025-03-26");
  });

  it("rend la plus récente sinon", () => {
    expect(negotiateVersion("1999-01-01")).toBe(SUPPORTED_PROTOCOL_VERSIONS[0]);
    expect(negotiateVersion(undefined)).toBe(SUPPORTED_PROTOCOL_VERSIONS[0]);
  });
});

describe("missingArguments", () => {
  it("nomme les arguments requis absents ou vides", () => {
    expect(missingArguments(echo().inputSchema, {})).toEqual(["texte"]);
    expect(missingArguments(echo().inputSchema, { texte: "" })).toEqual(["texte"]);
    expect(missingArguments(echo().inputSchema, { texte: "a" })).toEqual([]);
  });
});

describe("handleMessage", () => {
  it("répond à initialize avec la capacité outils", async () => {
    const response = await handleMessage(
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } },
      [echo()],
    );
    expect(response?.result).toMatchObject({
      protocolVersion: "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "antidotes" },
    });
  });

  it("ne répond rien à une notification", async () => {
    expect(
      await handleMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, [echo()]),
    ).toBeNull();
  });

  it("liste les outils avec leur indication de lecture seule", async () => {
    const response = await handleMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" }, [
      echo(),
      echo({ name: "ecrire", readOnly: false }),
    ]);
    const tools = (response?.result as { tools: { name: string; annotations: { readOnlyHint: boolean } }[] }).tools;
    expect(tools.map((tool) => [tool.name, tool.annotations.readOnlyHint])).toEqual([
      ["echo", true],
      ["ecrire", false],
    ]);
  });

  it("appelle un outil et rend son texte", async () => {
    const response = await handleMessage(
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "echo", arguments: { texte: "salut" } } },
      [echo()],
    );
    expect(response?.result).toEqual({ content: [{ type: "text", text: "salut" }], isError: false });
  });

  it("rend tels quels les blocs d'un outil qui en fournit, images comprises", async () => {
    const content = [
      { type: "text" as const, text: "visuel 1 · image" },
      { type: "image" as const, data: "/9j/AA==", mimeType: "image/jpeg" },
    ];
    const response = await handleMessage(
      { jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "echo", arguments: { texte: "x" } } },
      [echo({ run: async () => ({ text: "visuel 1 · image", content }) })],
    );
    expect(response?.result).toEqual({ content, isError: false });
  });

  it("rend une erreur d'outil au modèle plutôt qu'une erreur de protocole", async () => {
    const response = await handleMessage(
      { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "echo", arguments: { texte: "x" } } },
      [echo({ run: async () => { throw new Error("Client introuvable."); } })],
    );
    expect(response?.error).toBeUndefined();
    expect(response?.result).toEqual({
      content: [{ type: "text", text: "Client introuvable." }],
      isError: true,
    });
  });

  it("dit l'argument manquant sans appeler l'outil", async () => {
    let called = false;
    const response = await handleMessage(
      { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "echo", arguments: {} } },
      [echo({ run: async () => { called = true; return { text: "" }; } })],
    );
    expect(called).toBe(false);
    expect(response?.result).toMatchObject({ isError: true });
  });

  it("refuse un outil inconnu et une méthode inconnue", async () => {
    const unknownTool = await handleMessage(
      { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "rien" } },
      [echo()],
    );
    expect(unknownTool?.error?.code).toBe(-32602);
    const unknownMethod = await handleMessage({ jsonrpc: "2.0", id: 7, method: "resources/list" }, []);
    expect(unknownMethod?.error?.code).toBe(-32601);
  });
});

describe("handleBody", () => {
  it("rend une erreur de lecture sur un JSON invalide", async () => {
    expect(await handleBody("{", [])).toMatchObject({ error: { code: -32700 } });
  });

  it("traite un lot et ignore ses notifications", async () => {
    const response = await handleBody(
      JSON.stringify([
        { jsonrpc: "2.0", method: "notifications/initialized" },
        { jsonrpc: "2.0", id: 1, method: "ping" },
      ]),
      [],
    );
    expect(response).toEqual([{ jsonrpc: "2.0", id: 1, result: {} }]);
  });

  it("ne rend rien pour un corps de notifications seules", async () => {
    expect(await handleBody(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }), [])).toBeNull();
  });
});
