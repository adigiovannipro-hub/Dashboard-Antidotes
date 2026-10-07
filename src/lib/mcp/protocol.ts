/**
 * Le protocole MCP, réduit à ce qu'un connecteur de Claude emploie.
 *
 * Claude (claude.ai, appli de bureau et mobile) parle à un connecteur
 * personnalisé en « Streamable HTTP » : des messages JSON-RPC 2.0 postés sur
 * une seule adresse. Le serveur a le droit de répondre en JSON simple plutôt
 * qu'en flux SSE, et c'est ce qu'il fait ici : chaque appel d'outil est une
 * lecture ou une écriture en base, rien qui justifie un flux.
 *
 * Pas de session côté serveur : une fonction Vercel ne garde rien d'un appel
 * à l'autre, et aucun outil n'en a besoin.
 *
 * Écrit à la main plutôt que tiré d'une bibliothèque : le SDK officiel et
 * l'adaptateur Vercel ont changé de forme deux fois en un an, et les quatre
 * méthodes utiles tiennent en une page testée. Ce fichier est pur — aucun
 * import de base, aucun secret.
 */

export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

export const SERVER_INFO = { name: "antidotes", version: "1.0.0" };

/** Un schéma JSON d'entrée, tel que le client l'affiche au modèle. */
export type JsonSchema = {
  type: "object";
  properties: Record<string, { type: string; description: string; enum?: string[] }>;
  required?: string[];
};

/** Un bloc de réponse : du texte, ou une image en base64 que le modèle voit. */
export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

/**
 * Le résultat d'un outil. `text` suffit à presque tous ; `content`, quand il
 * est fourni, remplace le bloc texte unique — c'est ainsi qu'un outil rend des
 * images intercalées de leurs légendes. Ajout du 7/10/2026, sans effet sur les
 * outils qui ne s'en servent pas : leur réponse reste octet pour octet la même.
 */
export type ToolResult = { text: string; isError?: boolean; content?: ContentBlock[] };

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  /** Lecture seule : le client peut l'appeler sans demander de confirmation. */
  readOnly: boolean;
  run: (args: Record<string, unknown>) => Promise<ToolResult>;
};

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

export type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
};

const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;

function failure(id: JsonRpcResponse["id"], code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

/** La version demandée si on la parle, sinon la plus récente qu'on connaisse. */
export function negotiateVersion(requested: unknown): string {
  return typeof requested === "string" && SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
    ? requested
    : SUPPORTED_PROTOCOL_VERSIONS[0]!;
}

/** Les champs `required` du schéma, absents ou vides dans l'appel. */
export function missingArguments(schema: JsonSchema, args: Record<string, unknown>): string[] {
  return (schema.required ?? []).filter((key) => {
    const value = args[key];
    return value === undefined || value === null || value === "";
  });
}

/**
 * Un message JSON-RPC → sa réponse, ou `null` pour une notification (un
 * message sans `id` n'attend rien : `notifications/initialized` en est une).
 */
export async function handleMessage(
  message: unknown,
  tools: ToolDefinition[],
): Promise<JsonRpcResponse | null> {
  if (typeof message !== "object" || message === null || Array.isArray(message)) {
    return failure(null, INVALID_REQUEST, "Message JSON-RPC invalide.");
  }
  const request = message as JsonRpcRequest;
  const id = request.id ?? null;
  const isNotification = request.id === undefined;

  if (request.jsonrpc !== "2.0" || typeof request.method !== "string") {
    return isNotification ? null : failure(id, INVALID_REQUEST, "Message JSON-RPC invalide.");
  }
  if (isNotification) return null;

  switch (request.method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: negotiateVersion(request.params?.protocolVersion),
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions:
            "Le tableau de bord Antidotes : clients, plannings éditoriaux, FAQ, contexte et chiffres du mois. " +
            "Commencer par lister_clients pour connaître les identifiants d'espace.",
        },
      };

    case "ping":
      return { jsonrpc: "2.0", id, result: {} };

    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            annotations: { readOnlyHint: tool.readOnly, destructiveHint: false },
          })),
        },
      };

    case "tools/call": {
      const name = request.params?.name;
      const tool = tools.find((candidate) => candidate.name === name);
      if (!tool) return failure(id, INVALID_PARAMS, `Outil inconnu : ${String(name)}.`);

      const rawArgs = request.params?.arguments;
      const args =
        typeof rawArgs === "object" && rawArgs !== null && !Array.isArray(rawArgs)
          ? (rawArgs as Record<string, unknown>)
          : {};
      const missing = missingArguments(tool.inputSchema, args);
      if (missing.length > 0) {
        return toolResponse(id, { text: `Argument manquant : ${missing.join(", ")}.`, isError: true });
      }

      try {
        return toolResponse(id, await tool.run(args));
      } catch (error) {
        // Une erreur d'outil se rend au modèle, qui peut corriger son appel ;
        // une erreur de protocole, elle, casserait l'échange.
        const text = error instanceof Error ? error.message : "Erreur inattendue.";
        return toolResponse(id, { text, isError: true });
      }
    }

    default:
      return failure(id, METHOD_NOT_FOUND, `Méthode non prise en charge : ${request.method}.`);
  }
}

function toolResponse(id: JsonRpcResponse["id"], result: ToolResult): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: result.content ?? [{ type: "text", text: result.text }],
      isError: result.isError ?? false,
    },
  };
}

/**
 * Le corps d'une requête HTTP → ce qu'il faut répondre. Un lot (tableau) rend
 * un tableau ; un corps qui ne contient que des notifications ne rend rien
 * (202 sans corps, côté route).
 */
export async function handleBody(
  raw: string,
  tools: ToolDefinition[],
): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return failure(null, PARSE_ERROR, "Corps JSON illisible.");
  }

  if (Array.isArray(parsed)) {
    const responses = (await Promise.all(parsed.map((message) => handleMessage(message, tools))))
      .filter((response): response is JsonRpcResponse => response !== null);
    return responses.length > 0 ? responses : null;
  }
  return handleMessage(parsed, tools);
}
