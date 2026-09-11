/**
 * La complétude du brief, telle que la barre de tête l'affiche.
 *
 * Elle remplace quatre cartes de mesure qui répondaient à des questions que
 * personne ne se posait en ouvrant la page (« combien de documents injectés »)
 * et taisaient la seule qui compte : qu'est-ce qui manque, et où le remplir.
 * Chaque bloc vide devient donc un lien vers son ancre.
 *
 * Module pur : l'ancre est la même chaîne que l'`id` du bloc dans l'écran,
 * et c'est le test qui garantit qu'aucun bloc n'est ajouté sans son ancre.
 */
import { normalizeDeliverables, totalPublications } from "./deliverables";
import type { ClientContext, ClientGenerationSettings } from "./types";

/** Un bloc du brief et son état de remplissage. */
export type CompletenessEntry = {
  /** Ancre DOM du bloc, sans `#`. */
  ancre: string;
  label: string;
  rempli: boolean;
};

export type Completeness = {
  entries: CompletenessEntry[];
  remplis: number;
  total: number;
  /** Arrondi à l'entier — un brief n'est pas une mesure de laboratoire. */
  pourcentage: number;
};

const filled = (value: string | null | undefined) =>
  typeof value === "string" && value.trim().length > 0;

/* Colonnes `jsonb` : le type dit ce que l'écran y écrit, pas ce que la base y
   contient. Une valeur qui n'est pas un tableau ne doit pas faire tomber la
   page — même raison que `asList` dans `injected-context.ts`. */
const asList = <T,>(value: T[] | null | undefined): T[] =>
  Array.isArray(value) ? value : [];

/**
 * Les blocs comptés, dans l'ordre de la page.
 *
 * Le pilotage de la génération **n'entre pas dans le compte** : instructions
 * permanentes et consigne du mois sont des leviers, pas des cases à remplir —
 * un brief complet n'a aucune raison d'en porter, et les y mettre ferait
 * plafonner tous les clients à 85 % pour toujours.
 */
export function computeCompleteness(input: {
  brief: ClientContext | null;
  settings: ClientGenerationSettings | null;
}): Completeness {
  const brief = input.brief;
  const deliverables = normalizeDeliverables(brief?.deliverables);

  const entries: CompletenessEntry[] = [
    { ancre: "marque", label: "La marque", rempli: filled(brief?.main_context) },
    { ancre: "cibles", label: "Cibles", rempli: filled(brief?.audience) },
    {
      ancre: "livrables",
      label: "Livrables mensuels",
      rempli: totalPublications(deliverables) > 0,
    },
    {
      ancre: "piliers",
      label: "Piliers de contenu",
      rempli: asList(brief?.pillars).length > 0,
    },
    { ancre: "ton", label: "Tone of voice", rempli: filled(brief?.tone_of_voice) },
    {
      ancre: "plateformes",
      label: "Règles par plateforme",
      rempli: Object.values(brief?.platforms ?? {}).some((rule) => filled(rule)),
    },
    { ancre: "interdits", label: "Interdits", rempli: filled(brief?.restrictions) },
    {
      ancre: "exemples",
      label: "Exemples validés",
      rempli: asList(brief?.validated_examples).length > 0,
    },
    {
      ancre: "retours",
      label: "Retours du client",
      rempli: filled(brief?.client_feedback),
    },
    {
      ancre: "faits",
      label: "Faits sourcés",
      rempli: asList(brief?.sourced_facts).length > 0,
    },
  ];

  const remplis = entries.filter((entry) => entry.rempli).length;
  return {
    entries,
    remplis,
    total: entries.length,
    pourcentage: Math.round((remplis / entries.length) * 100),
  };
}

/** Les blocs qui restent à remplir — ceux que la barre offre en liens. */
export function missingEntries(completeness: Completeness): CompletenessEntry[] {
  return completeness.entries.filter((entry) => !entry.rempli);
}
