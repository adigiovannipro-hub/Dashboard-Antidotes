import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { MISSING_VALUE, fillTemplate, templateKeys } from "./prompt-template";

/**
 * Ce fichier ferme une classe entière de pannes silencieuses.
 *
 * Les prompts sont des markdown éditables sans toucher au code — c'est le
 * cahier des charges qui l'exige — et le pont entre les deux est un simple nom
 * de variable. Renommer `{{objectifs}}` dans un `.md` sans le renommer dans
 * `generate.ts` ne casse rien : la variable devient « Non renseigné. », la
 * génération continue en dégradé, et ni le typecheck ni les autres tests ne le
 * voient. La vérification se fait donc sur les **sources**, en rapprochant les
 * variables des gabarits des clés que leurs appelants passent réellement.
 */

const PROMPTS = ["intentions", "wording", "reporting"] as const;

const root = path.join(process.cwd(), "src", "lib");

function readTemplate(name: (typeof PROMPTS)[number]): string {
  return readFileSync(path.join(root, "prompts", `${name}.md`), "utf8");
}

const generateSource = readFileSync(path.join(root, "production", "generate.ts"), "utf8");

/** Les clés du littéral passé à `renderPrompt("<nom>", { … })` dans `generate.ts`. */
function keysPassedBy(name: (typeof PROMPTS)[number]): string[] {
  const start = generateSource.indexOf(`renderPrompt("${name}", {`);
  expect(start, `aucun appel à renderPrompt("${name}") dans generate.ts`).toBeGreaterThan(-1);
  const end = generateSource.indexOf("\n  });", start);
  expect(end, `littéral non refermé pour renderPrompt("${name}")`).toBeGreaterThan(start);
  const body = generateSource.slice(start, end);
  // `historique,` autant que `historique: …` : la forme abrégée d'un objet
  // littéral est une clé comme une autre.
  return [...body.matchAll(/^\s{4}(\w+)\s*[,:]/gm)].map((match) => match[1]!);
}

describe("fillTemplate", () => {
  it("remplace chaque variable par sa valeur", () => {
    expect(fillTemplate("Mois : {{mois}}.", { mois: "juillet 2026" })).toBe(
      "Mois : juillet 2026.",
    );
  });

  it("dit qu'une valeur manque plutôt que de laisser un trou", () => {
    expect(fillTemplate("Objectifs : {{objectifs}}", {})).toBe(`Objectifs : ${MISSING_VALUE}`);
  });

  it("traite une valeur vide comme une valeur absente", () => {
    // Un bloc de performance vide — client sans connecteur — doit se dire, pas
    // laisser le modèle croire qu'on lui a servi une liste.
    expect(fillTemplate("{{mesures}}", { mesures: "   " })).toBe(MISSING_VALUE);
  });

  it("remplace toutes les occurrences d'une même variable", () => {
    expect(fillTemplate("{{m}} puis {{m}}", { m: "août" })).toBe("août puis août");
  });
});

describe("templateKeys", () => {
  it("rend chaque variable une seule fois, dans l'ordre", () => {
    expect(templateKeys("{{a}} {{b}} {{a}}")).toEqual(["a", "b"]);
  });
});

describe("renderPrompt", () => {
  for (const name of PROMPTS) {
    it(`ne laisse aucune variable non résolue dans ${name}.md`, () => {
      const template = readTemplate(name);
      const values = Object.fromEntries(
        templateKeys(template).map((key) => [key, `valeur-${key}`]),
      );
      expect(fillTemplate(template, values)).not.toMatch(/\{\{\w+\}\}/);
    });

    it(`generate.ts fournit toutes les variables de ${name}.md`, () => {
      const attendues = templateKeys(readTemplate(name));
      const fournies = keysPassedBy(name);
      const manquantes = attendues.filter((key) => !fournies.includes(key));
      expect(manquantes, `variables jamais fournies, donc rendues « ${MISSING_VALUE} »`).toEqual(
        [],
      );
    });

    it(`generate.ts ne fournit rien que ${name}.md n'attende`, () => {
      // Le sens inverse : une clé passée à une variable disparue du gabarit est
      // du travail fait pour rien, et le signe que les deux ont divergé.
      const attendues = templateKeys(readTemplate(name));
      const inutiles = keysPassedBy(name).filter((key) => !attendues.includes(key));
      expect(inutiles, "clés passées à des variables qui n'existent plus").toEqual([]);
    });
  }
});
