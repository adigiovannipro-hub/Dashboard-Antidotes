/**
 * Assemblage du contexte injecté dans les prompts de génération.
 *
 * Fonction pure, partagée entre `getClientContext()` (qui la sert aux routes
 * de génération) et le compteur de tokens de la page (qui mesure exactement
 * la même chaîne — sinon le chiffre affiché ne mesurerait rien).
 */
import type { ClientAsset, ClientContext } from "./types";
import { ASSET_TYPE_LABELS } from "./types";

/** Le brief mis à plat, dans l'ordre où les prompts le lisent. */
export function renderBrief(brief: ClientContext | null): string {
  if (!brief) return "";

  const lines: string[] = [];
  const push = (label: string, value: string | null) => {
    if (value && value.trim().length > 0) lines.push(`${label} :\n${value.trim()}`);
  };

  push("Contexte principal", brief.main_context);
  push("Positionnement", brief.positioning);
  push("Cibles", brief.audience);
  push("Tone of voice", brief.tone_of_voice);

  if (brief.pillars.length > 0) {
    const pillars = brief.pillars
      .map((pillar) => {
        const details = [
          pillar.description.trim(),
          pillar.formats.length > 0 ? `Formats : ${pillar.formats.join(", ")}` : "",
          pillar.angles.length > 0 ? `Angles : ${pillar.angles.join(", ")}` : "",
          pillar.frequence.trim() ? `Fréquence : ${pillar.frequence.trim()}` : "",
        ].filter(Boolean);
        return `- ${pillar.nom}\n  ${details.join("\n  ")}`;
      })
      .join("\n");
    lines.push(`Piliers de contenu :\n${pillars}`);
  }

  push("Mentions", brief.mentions);
  push("Interdits (contraignants)", brief.restrictions);

  return lines.join("\n\n");
}

/** Les résumés des documents cochés, chacun sous son titre. */
export function renderAssetSummaries(assets: ClientAsset[]): string {
  return assets
    .filter((asset) => asset.include_in_context && asset.summary?.trim())
    .map(
      (asset) =>
        `[${ASSET_TYPE_LABELS[asset.type]} : ${asset.name}]\n${asset.summary!.trim()}`,
    )
    .join("\n\n");
}

/** Les règles de plateforme non vides, prêtes à filtrer par réseau. */
export function extractPlatformRules(
  brief: ClientContext | null,
): Record<string, string> {
  if (!brief) return {};

  const rules: Record<string, string> = {};
  for (const [platform, rule] of Object.entries(brief.platforms)) {
    if (typeof rule === "string" && rule.trim().length > 0) {
      rules[platform] = rule.trim();
    }
  }
  return rules;
}

/**
 * La chaîne complète que reçoivent les prompts de génération — c'est elle
 * que le compteur de la page mesure.
 */
export function buildInjectedContext(input: {
  brief: ClientContext | null;
  assetSummaries: string;
  platformRules: Record<string, string>;
}): string {
  const parts = [renderBrief(input.brief)];

  const platforms = Object.entries(input.platformRules)
    .map(([platform, rule]) => `- ${platform} : ${rule}`)
    .join("\n");
  if (platforms) parts.push(`Règles par plateforme :\n${platforms}`);

  if (input.assetSummaries) {
    parts.push(`Résumés des documents de référence :\n\n${input.assetSummaries}`);
  }

  return parts.filter(Boolean).join("\n\n");
}
