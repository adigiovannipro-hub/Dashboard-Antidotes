/**
 * Prompts d'extraction, un par type de document.
 *
 * Le `Record<ClientAssetType, string>` est le garde-fou d'exhaustivité :
 * ajouter un type de document sans écrire son prompt casse la compilation.
 * Chaque prompt cible ce qui est éditorialement utile, pas un résumé
 * générique.
 */
import type { ClientAssetType } from "../types";
import { BENCHMARK_PROMPT } from "./benchmark";
import { GUIDELINES_PROMPT } from "./guidelines";
import { LOOKBOOK_PROMPT } from "./lookbook";
import { OTHER_PROMPT } from "./other";
import { QUESTIONNAIRE_PROMPT } from "./questionnaire";
import { STRATEGY_PROMPT } from "./strategy";
import { WEBSITE_PROMPT } from "./website";

export const EXTRACTION_PROMPTS: Record<ClientAssetType, string> = {
  website: WEBSITE_PROMPT,
  questionnaire: QUESTIONNAIRE_PROMPT,
  strategy: STRATEGY_PROMPT,
  lookbook: LOOKBOOK_PROMPT,
  guidelines: GUIDELINES_PROMPT,
  benchmark: BENCHMARK_PROMPT,
  other: OTHER_PROMPT,
};

export { buildConsolidationPrompt, CONSOLIDATION_PROMPT } from "./consolidation";
