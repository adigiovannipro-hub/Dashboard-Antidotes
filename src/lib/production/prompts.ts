import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

import { fillTemplate } from "./prompt-template";

/**
 * Chargement des prompts système depuis `src/lib/prompts/*.md`.
 *
 * Les prompts sont des fichiers markdown éditables sans toucher au code — le
 * cahier des charges l'exige. Lus au premier appel puis gardés en mémoire :
 * le fichier ne change pas pendant la vie du processus, et un `readFileSync`
 * par sujet de wording serait du gaspillage.
 *
 * Le dossier est déclaré dans `outputFileTracingIncludes` de `next.config.ts`,
 * sans quoi Vercel ne l'embarquerait pas dans le bundle des fonctions.
 */

const PROMPTS_DIR = path.join(process.cwd(), "src", "lib", "prompts");

const cache = new Map<string, string>();

function loadTemplate(name: "intentions" | "wording" | "reporting"): string {
  const cached = cache.get(name);
  if (cached) return cached;
  const content = readFileSync(path.join(PROMPTS_DIR, `${name}.md`), "utf8");
  cache.set(name, content);
  return content;
}

/**
 * Remplit les variables `{{nom}}` d'un template.
 *
 * La substitution elle-même vit dans `prompt-template.ts`, module pur : c'est
 * le seul moyen de la tester, ce fichier-ci ne pouvant pas s'importer hors du
 * serveur.
 */
export function renderPrompt(
  name: "intentions" | "wording" | "reporting",
  values: Record<string, string>,
): string {
  return fillTemplate(loadTemplate(name), values);
}
