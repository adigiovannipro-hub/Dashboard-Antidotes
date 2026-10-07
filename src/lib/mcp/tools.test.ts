// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

/**
 * La liste réelle des outils du connecteur. L'ajout de `lire_visuels`
 * (7/10/2026) devait être purement additif : les vingt-cinq outils d'avant
 * gardent leur nom, leur ordre et leur caractère lecture/écriture.
 */

vi.mock("server-only", () => ({}));

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "anon";
});

const BEFORE = [
  ["lister_clients", true],
  ["lire_contexte", true],
  ["modifier_contexte", false],
  ["lire_planning", true],
  ["lire_retours_publication", true],
  ["ecrire_wording", false],
  ["ajouter_intention", false],
  ["modifier_publication", false],
  ["commenter_publication", false],
  ["lire_faq", true],
  ["modifier_faq", false],
  ["lire_reporting", true],
  ["lire_synthese_mensuelle", true],
  ["lire_mon_travail", true],
  ["creer_tache", false],
  ["cocher_tache", false],
  ["lire_cartes_production", true],
  ["lire_inbox", true],
  ["generer_brouillon_reponse", false],
  ["lire_finance", true],
  ["lire_pipeline_prospects", true],
  ["noter_prospect", false],
  ["lire_sequences", true],
  ["lire_inbound", true],
  ["creer_brouillon_linkedin", false],
] as const;

describe("MCP_TOOLS", () => {
  it("garde les vingt-cinq outils d'avant, dans le même ordre, et ajoute lire_visuels en lecture seule", async () => {
    const { MCP_TOOLS } = await import("./tools");
    const listed = MCP_TOOLS.map((tool) => [tool.name, tool.readOnly] as const);

    expect(listed.filter(([name]) => name !== "lire_visuels")).toEqual(BEFORE);
    expect(listed).toContainEqual(["lire_visuels", true]);
    expect(new Set(MCP_TOOLS.map((tool) => tool.name)).size).toBe(MCP_TOOLS.length);
  });

  it("n'exige de lire_visuels que l'identifiant de la publication", async () => {
    const { MCP_TOOLS } = await import("./tools");
    const tool = MCP_TOOLS.find((candidate) => candidate.name === "lire_visuels");
    expect(tool?.inputSchema.required).toEqual(["publication_id"]);
    expect(Object.keys(tool?.inputSchema.properties ?? {})).toEqual(["publication_id", "index"]);
  });
});
