/**
 * Le remplacement des variables `{{nom}}` d'un prompt — **module pur**.
 *
 * Séparé de `prompts.ts`, qui porte `server-only` parce qu'il lit le disque :
 * la substitution, elle, se teste. Et elle a besoin de l'être — une variable
 * renommée dans un `.md` sans l'être dans `generate.ts` devient silencieusement
 * « Non renseigné. », la génération continue en dégradé, et ni le typecheck ni
 * les tests ne voient passer quoi que ce soit.
 */

/**
 * Ce qu'une variable sans valeur devient.
 *
 * Une mention explicite, jamais un trou : le modèle doit savoir qu'une donnée
 * manque, pas deviner. C'est la même règle que le `—` de l'interface.
 */
export const MISSING_VALUE = "Non renseigné.";

const VARIABLE = /\{\{(\w+)\}\}/g;

/** Les variables d'un gabarit, dans l'ordre d'apparition, sans doublon. */
export function templateKeys(template: string): string[] {
  return [...new Set([...template.matchAll(VARIABLE)].map((match) => match[1]!))];
}

export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(VARIABLE, (_match, key: string) => {
    const value = values[key];
    return value !== undefined && value.trim() !== "" ? value : MISSING_VALUE;
  });
}
