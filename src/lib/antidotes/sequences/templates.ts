/**
 * Les gabarits d'une étape — objet et corps — et leurs variables.
 *
 * Module pur : un gabarit se rend dans un test sans base ni boîte mail. La
 * syntaxe est volontairement minuscule, `{{prenom}}` et `{{prenom|à vous}}`
 * pour un repli, parce qu'un gabarit se tape dans un `<textarea>` et se relit
 * dans un email : tout langage plus riche finirait par s'y cacher.
 *
 * Une variable sans valeur ni repli est **manquante**, et un email ne part
 * jamais avec un trou : c'est l'envoi qui décide quoi faire d'un manque, ici
 * on se contente de le nommer.
 */

export const TEMPLATE_VARIABLES = [
  "prenom",
  "nom",
  "societe",
  "ville",
  "secteur",
  "observation",
  "lien_case_study",
  "expediteur",
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

export const TEMPLATE_VARIABLE_LABELS: Record<TemplateVariable, string> = {
  prenom: "Prénom du contact",
  nom: "Nom du contact",
  societe: "Société",
  ville: "Ville",
  secteur: "Secteur",
  observation: "Observation (pubs ou site)",
  lien_case_study: "Lien du case study",
  expediteur: "Votre nom",
};

export type TemplateContext = Partial<Record<TemplateVariable, string | null | undefined>>;

const PLACEHOLDER = /\{\{\s*([a-z_]+)\s*(?:\|([^}]*))?\}\}/g;

/** Les noms de variables d'un gabarit, dans l'ordre d'apparition, sans doublon. */
export function listPlaceholders(template: string): string[] {
  const names: string[] = [];
  for (const match of template.matchAll(PLACEHOLDER)) {
    const name = match[1]!;
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

export function isTemplateVariable(name: string): name is TemplateVariable {
  return (TEMPLATE_VARIABLES as readonly string[]).includes(name);
}

export type RenderedTemplate = {
  text: string;
  /** Les variables sans valeur ni repli, ou inconnues : rien ne doit partir tant qu'il y en a. */
  missing: string[];
};

export function renderTemplate(template: string, context: TemplateContext): RenderedTemplate {
  const missing: string[] = [];
  const text = template.replace(PLACEHOLDER, (whole, rawName: string, fallback?: string) => {
    const name = rawName as string;
    if (!isTemplateVariable(name)) {
      if (!missing.includes(name)) missing.push(name);
      return whole;
    }
    const value = context[name]?.trim();
    if (value) return value;
    if (fallback !== undefined) return fallback.trim();
    if (!missing.includes(name)) missing.push(name);
    return whole;
  });
  return { text, missing };
}

/**
 * Le prénom d'un contact tel qu'on l'écrit en tête d'un email : le premier
 * mot, avec sa majuscule — « jean-marc » devient « Jean-Marc », « CAMILLE »
 * devient « Camille ». Une casse brute vient souvent d'un registre.
 */
export function greetingName(firstName: string | null | undefined): string | null {
  const first = firstName?.trim().split(/\s+/)[0];
  if (!first) return null;
  return first
    .toLocaleLowerCase("fr-FR")
    .split("-")
    .map((part) => (part ? part[0]!.toLocaleUpperCase("fr-FR") + part.slice(1) : part))
    .join("-");
}
