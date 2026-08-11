import { describe, expect, it } from "vitest";

import {
  buildInjectedContext,
  extractPlatformRules,
  renderAssetSummaries,
  renderBrief,
} from "./injected-context";
import type { ClientAsset, ClientContext } from "./types";

const makeContext = (overrides: Partial<ClientContext> = {}): ClientContext => ({
  id: "ctx-1",
  workspace_id: "ws-1",
  version: 1,
  is_active: true,
  main_context: "Marque de maroquinerie lyonnaise.",
  positioning: null,
  audience: null,
  tone_of_voice: null,
  pillars: [],
  mentions: null,
  restrictions: "Jamais de solde affichée.",
  platforms: { instagram: "Tutoiement.", linkedin: "  " },
  created_at: "2026-08-01T00:00:00Z",
  created_by: null,
  ...overrides,
});

const makeAsset = (overrides: Partial<ClientAsset> = {}): ClientAsset => ({
  id: "asset-1",
  workspace_id: "ws-1",
  name: "strategie-2026.pdf",
  type: "strategy",
  storage_path: "ws-1/contexte/strategie-2026.pdf",
  mime_type: "application/pdf",
  size_bytes: 1000,
  summary: "Trois piliers : atelier, produit, communauté.",
  summary_edited_manually: false,
  include_in_context: true,
  extraction_status: "done",
  extraction_error: null,
  created_at: "2026-08-01T00:00:00Z",
  ...overrides,
});

describe("renderBrief", () => {
  it("ne rend que les champs remplis, sous leur libellé", () => {
    const brief = renderBrief(makeContext());

    expect(brief).toContain("Contexte principal :");
    expect(brief).toContain("maroquinerie lyonnaise");
    expect(brief).toContain("Interdits (contraignants) :");
    expect(brief).not.toContain("Positionnement");
  });

  it("rend une chaîne vide sans brief", () => {
    expect(renderBrief(null)).toBe("");
  });
});

describe("renderAssetSummaries", () => {
  it("n'injecte que les documents cochés et résumés", () => {
    const rendered = renderAssetSummaries([
      makeAsset(),
      makeAsset({ id: "a2", include_in_context: false, summary: "Ne doit pas sortir." }),
      makeAsset({ id: "a3", summary: null }),
    ]);

    expect(rendered).toContain("[Stratégie : strategie-2026.pdf]");
    expect(rendered).toContain("Trois piliers");
    expect(rendered).not.toContain("Ne doit pas sortir.");
  });
});

describe("extractPlatformRules", () => {
  it("écarte les règles vides et garde les autres", () => {
    expect(extractPlatformRules(makeContext())).toEqual({ instagram: "Tutoiement." });
    expect(extractPlatformRules(null)).toEqual({});
  });
});

describe("buildInjectedContext", () => {
  it("assemble brief, règles et résumés dans une seule chaîne", () => {
    const injected = buildInjectedContext({
      brief: makeContext(),
      assetSummaries: renderAssetSummaries([makeAsset()]),
      platformRules: { instagram: "Tutoiement." },
    });

    expect(injected).toContain("Contexte principal");
    expect(injected).toContain("Règles par plateforme :");
    expect(injected).toContain("Résumés des documents de référence :");
  });

  it("reste vide quand il n'y a ni brief ni document", () => {
    expect(
      buildInjectedContext({ brief: null, assetSummaries: "", platformRules: {} }),
    ).toBe("");
  });
});
