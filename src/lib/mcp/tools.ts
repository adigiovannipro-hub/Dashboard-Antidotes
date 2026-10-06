import "server-only";

import type { ToolDefinition } from "./protocol";
import { AGENCE_TOOLS } from "./tools-agence";
import { PLANNING_TOOLS } from "./tools-planning";
import { PROSPECTION_TOOLS } from "./tools-prospection";

/**
 * Les outils du connecteur Claude, validés le 6/10/2026.
 *
 * Lecture partout, écriture seulement là où rien ne quitte la base : aucun
 * outil ne publie, n'envoie de courriel, ne répond chez Meta, ne supprime ni
 * ne valide. La Finance est en lecture seule.
 */
export const MCP_TOOLS: ToolDefinition[] = [...PLANNING_TOOLS, ...AGENCE_TOOLS, ...PROSPECTION_TOOLS];
