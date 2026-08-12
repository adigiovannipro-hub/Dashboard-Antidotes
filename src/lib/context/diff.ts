/**
 * Diff champ par champ entre le brief actuel et une proposition de
 * consolidation. C'est lui qui interdit l'écrasement silencieux : chaque
 * champ s'accepte ou se refuse individuellement, et seule la fusion des
 * champs acceptés devient la version suivante.
 */
import type {
  ClientContext,
  ContextFieldKey,
  ContextPillar,
  ContextProposal,
} from "./types";
import { FIELD_KEYS, FIELD_LABELS } from "./types";

export type ContextFieldDiff = {
  key: ContextFieldKey;
  label: string;
  /** Valeur actuelle et proposée, rendues en texte lisible pour l'écran. */
  before: string;
  after: string;
  changed: boolean;
};

/** Un pilier par bloc, lisible dans une colonne de diff. */
export function renderPillarsText(pillars: ContextPillar[]): string {
  return pillars
    .map((pillar) => {
      const details = [
        pillar.description,
        pillar.formats.length > 0 ? `Formats : ${pillar.formats.join(", ")}` : "",
        pillar.angles.length > 0 ? `Angles : ${pillar.angles.join(", ")}` : "",
        pillar.frequence ? `Fréquence : ${pillar.frequence}` : "",
      ]
        .map((line) => line.trim())
        .filter(Boolean);
      return [pillar.nom, ...details].join("\n");
    })
    .join("\n\n");
}

export function renderPlatformsText(platforms: Record<string, string>): string {
  return Object.entries(platforms)
    .filter(([, rule]) => rule.trim().length > 0)
    .map(([platform, rule]) => `${platform} : ${rule.trim()}`)
    .join("\n");
}

/** La valeur d'un champ du brief, en texte — vide si le brief n'existe pas. */
function fieldText(
  context: Pick<ContextProposal, ContextFieldKey> | null,
  key: ContextFieldKey,
): string {
  if (!context) return "";
  if (key === "pillars") return renderPillarsText(context.pillars);
  if (key === "platforms") return renderPlatformsText(context.platforms);
  return (context[key] ?? "").trim();
}

/** Le brief ramené aux champs comparables, tolérant au `null`. */
function comparable(context: ClientContext | null): Pick<ContextProposal, ContextFieldKey> | null {
  if (!context) return null;
  return {
    main_context: context.main_context ?? "",
    positioning: context.positioning ?? "",
    audience: context.audience ?? "",
    tone_of_voice: context.tone_of_voice ?? "",
    pillars: context.pillars,
    mentions: context.mentions ?? "",
    restrictions: context.restrictions ?? "",
    platforms: context.platforms,
  };
}

export function buildContextDiff(
  current: ClientContext | null,
  proposal: ContextProposal,
): ContextFieldDiff[] {
  const base = comparable(current);

  return FIELD_KEYS.map((key) => {
    const before = fieldText(base, key);
    const after = fieldText(proposal, key);
    return {
      key,
      label: FIELD_LABELS[key],
      before,
      after,
      changed: before !== after,
    };
  });
}

/**
 * La fusion qui devient la version suivante : la proposition pour les champs
 * acceptés, l'existant pour les autres. Jamais d'écrasement d'un champ
 * refusé — c'est la moitié « versionnage » de la règle.
 */
export function mergeProposal(
  current: ClientContext | null,
  proposal: ContextProposal,
  acceptedKeys: ContextFieldKey[],
): ContextProposal {
  const base = comparable(current) ?? {
    main_context: "",
    positioning: "",
    audience: "",
    tone_of_voice: "",
    pillars: [],
    mentions: "",
    restrictions: "",
    platforms: {},
  };

  const accepted = new Set(acceptedKeys);
  const pick = <K extends ContextFieldKey>(key: K): ContextProposal[K] =>
    (accepted.has(key) ? proposal[key] : base[key]) as ContextProposal[K];

  return {
    main_context: pick("main_context"),
    positioning: pick("positioning"),
    audience: pick("audience"),
    tone_of_voice: pick("tone_of_voice"),
    pillars: pick("pillars"),
    mentions: pick("mentions"),
    restrictions: pick("restrictions"),
    platforms: pick("platforms"),
  };
}
