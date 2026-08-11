import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

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
 * Une variable absente des valeurs devient une mention explicite plutôt qu'un
 * trou : le modèle doit savoir qu'une donnée manque, pas deviner.
 */
export function renderPrompt(
  name: "intentions" | "wording" | "reporting",
  values: Record<string, string>,
): string {
  return loadTemplate(name).replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = values[key];
    return value !== undefined && value.trim() !== "" ? value : "Non renseigné.";
  });
}
