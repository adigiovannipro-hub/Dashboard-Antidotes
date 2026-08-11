/**
 * Validation de la proposition de consolidation renvoyée par le modèle.
 *
 * Le JSON attendu porte les clés françaises du prompt (`contexte_principal`,
 * `piliers`…) ; on les traduit ici vers les colonnes anglaises de la base.
 * Fonction pure, sans zod : la frontière zod du projet est réservée aux
 * Server Actions, et une sortie de modèle se valide champ par champ avec
 * une tolérance explicite — un champ manquant vaut vide, jamais une erreur.
 */
import type { ContextPillar, ContextProposal } from "./types";

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function asPillars(value: unknown): ContextPillar[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> =>
      Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
    )
    .map((entry) => ({
      nom: asText(entry.nom),
      description: asText(entry.description),
      formats: asTextArray(entry.formats),
      angles: asTextArray(entry.angles),
      frequence: asText(entry.frequence),
    }))
    .filter((pillar) => pillar.nom.length > 0 || pillar.description.length > 0);
}

function asPlatformRules(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const rules: Record<string, string> = {};
  for (const [platform, rule] of Object.entries(value as Record<string, unknown>)) {
    const key = platform.trim().toLowerCase();
    const text = asText(rule);
    if (key) rules[key] = text;
  }
  return rules;
}

/**
 * `null` uniquement si la sortie n'est pas un objet : un JSON valide aux
 * champs vides est une proposition valide (« ne jamais inventer » produit
 * précisément cela quand les documents ne disent rien).
 */
export function parseProposal(value: unknown): ContextProposal | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;

  return {
    main_context: asText(raw.contexte_principal),
    positioning: asText(raw.positionnement),
    audience: asText(raw.cibles),
    tone_of_voice: asText(raw.tone_of_voice),
    pillars: asPillars(raw.piliers),
    mentions: asText(raw.mentions),
    restrictions: asText(raw.interdits),
    platforms: asPlatformRules(raw.plateformes),
  };
}
