/**
 * Les mails de facturation : leurs modèles, et le remplissage des variables.
 *
 * Module **pur** — aucune base, aucun réseau. Il rend un objet et un corps à
 * partir de modèles et de faits ; l'envoi est ailleurs (`envoi.ts`).
 *
 * L'objet et le corps sont **deux champs distincts**. Ils ont été un seul un
 * moment, la première ligne faisant office d'objet : rien ne distinguait à
 * l'œil cette ligne du premier paragraphe, et une ligne vide oubliée suffisait
 * à envoyer un mail intitulé « Bonjour ».
 *
 * Les variables s'écrivent entre crochets, en français, accents compris :
 * `[prénom]`, `[période]`, `[montant]`. Le crochet plutôt que l'accolade
 * parce qu'un modèle se tape à la main dans un navigateur, et que `{{ }}`
 * est une syntaxe de développeur.
 *
 * Une variable inconnue n'est **pas** remplacée par du vide : elle est
 * signalée, et l'envoi s'arrête. Un mail parti chez un client avec
 * `[periode]` — sans accent, donc inconnue — en plein milieu est une faute
 * qu'aucun automatisme ne rattrape.
 */

import { SIGNATURE_TEXT } from "./signature";

/** Les variables qu'un modèle peut porter, et ce qu'elles disent. */
export const TEMPLATE_VARIABLES = {
  "[prénom]": "Le prénom du contact — « Jean ». Vide, la formule se replie.",
  "[client]": "Le nom du client — « Bondet ».",
  "[projet]": "L'intitulé de la prestation — « Accompagnement social media ».",
  "[mois]": "Le mois de prestation, sans l'année — « août ».",
  "[de mois]":
    "Le mois précédé de sa préposition, élision comprise — « de juillet », « d'août ».",
  "[période]": "Le mois de prestation avec l'année — « août 2026 ».",
  "[montant]": "Le montant TTC de la facture — « 2 522,50 € ».",
  "[numéro]": "Le numéro de la facture chez Airwallex — « INV-A9DFDGZ3-0005 ».",
  "[échéance]": "La date limite de règlement — « 5 septembre 2026 ».",
} as const;

export type TemplateVariable = keyof typeof TEMPLATE_VARIABLES;

const VARIABLE_NAMES = Object.keys(TEMPLATE_VARIABLES) as TemplateVariable[];

/**
 * L'objet des mails.
 *
 * Le même pour l'envoi et pour les trois relances, et c'est délibéré : un
 * objet identique garde les relances dans le fil de la facture d'origine —
 * le client retrouve la pièce jointe juste au-dessus, sans la chercher.
 *
 * « Alessandro x CLIENT » est la forme employée depuis toujours dans les
 * échanges : le « x » de collaboration, en minuscule, entre deux noms.
 */
export const DEFAULT_SEND_SUBJECT = "Alessandro x [client] : Facture du mois [de mois]";
export const DEFAULT_REMINDER_SUBJECT = DEFAULT_SEND_SUBJECT;

/**
 * L'envoi initial — repris des mails écrits à la main, à une chose près :
 * **aucune relance des mois précédents**. Le mail qui accompagne une facture
 * ne fait qu'une chose, et réclamer un impayé dans le même souffle affaiblit
 * les deux. Les relances ont leurs propres mails, à leur propre rythme.
 */
export const DEFAULT_SEND_TEMPLATE = `Hello [prénom],

J'espère que vous allez bien,

Vous trouverez en PJ la facture [de mois], d'un montant de [montant].

Le règlement est attendu pour le [échéance].

${SIGNATURE_TEXT}`;

/**
 * Les trois relances, et leur gradation.
 *
 * Elle va vers **plus** de chaleur et non vers plus de fermeté : à six
 * semaines, celui qui n'a pas payé est bien plus souvent débordé que de
 * mauvaise foi, et le ton comminatoire d'un automate abîme une relation que
 * deux lignes aimables préservent. La fermeté, s'il en faut, se dit au
 * téléphone — c'est d'ailleurs pour cela qu'il n'y a pas de quatrième mail.
 */
export const DEFAULT_REMINDER_1_TEMPLATE = `Hello [prénom],

Est-ce que vous pouvez regarder pour le règlement [de mois] svp 🙏

La facture [numéro], d'un montant de [montant], était échue le [échéance]. Je vous la remets en pièce jointe.

Si le règlement est déjà parti, merci d'ignorer ce message.

${SIGNATURE_TEXT}`;

export const DEFAULT_REMINDER_2_TEMPLATE = `Hello [prénom],

Je me permets de revenir vers vous au sujet de la facture [numéro] [de mois], d'un montant de [montant] — je la remets en pièce jointe pour vous éviter de la chercher.

Si quelque chose bloque de votre côté, dites-le moi, on trouvera une solution.

Merci beaucoup et à très vite,

${SIGNATURE_TEXT}`;

export const DEFAULT_REMINDER_3_TEMPLATE = `Hello [prénom],

Toujours au sujet de la facture [numéro] [de mois], d'un montant de [montant], échue depuis le [échéance]. Elle est de nouveau en pièce jointe.

Un mot suffit si vous préférez qu'on en parle de vive voix, je vous appelle quand vous voulez.

Merci beaucoup et à très vite,

${SIGNATURE_TEXT}`;

/** Les faits d'une facture, tels qu'un modèle peut les nommer. */
export type TemplateFacts = {
  firstName: string | null;
  clientName: string;
  projectLabel: string;
  /** Le mois seul — « août ». */
  month: string;
  /** Le mois et l'année — « août 2026 ». */
  period: string;
  /** Le montant, déjà formaté — « 2 522,50 € ». */
  amount: string;
  invoiceNumber: string;
  /** L'échéance, déjà formatée — « 5 septembre 2026 ». */
  dueDate: string;
};

export type RenderedEmail =
  | { ok: true; subject: string; body: string }
  | { ok: false; unknownVariables: string[] };

/**
 * « de juillet », mais « d'août ». L'élision devant une voyelle n'est pas
 * une coquetterie : « la facture du mois de août » saute aux yeux du client
 * avant le montant.
 */
function prepositionFor(month: string): string {
  return /^[aeiouâéèêîôûy]/i.test(month.trim()) ? `d'${month}` : `de ${month}`;
}

function valuesOf(facts: TemplateFacts): Record<TemplateVariable, string> {
  return {
    "[prénom]": facts.firstName?.trim() ?? "",
    "[client]": facts.clientName,
    "[projet]": facts.projectLabel,
    "[mois]": facts.month,
    "[de mois]": prepositionFor(facts.month),
    "[période]": facts.period,
    "[montant]": facts.amount,
    "[numéro]": facts.invoiceNumber,
    "[échéance]": facts.dueDate,
  };
}

/**
 * Les variables d'un modèle que personne ne sait remplir.
 *
 * Exportée à part parce que le formulaire s'en sert pour prévenir **avant**
 * d'enregistrer : la faute de frappe se corrige à la saisie, pas au moment
 * où le mail aurait dû partir.
 */
export function unknownVariablesIn(template: string): string[] {
  const found = template.match(/\[[^\]\n]{1,40}\]/g) ?? [];
  const known = new Set<string>(VARIABLE_NAMES);
  return [...new Set(found.filter((name) => !known.has(name)))];
}

/** Remplit un texte, sans rien décider de sa structure. */
function fill(template: string, values: Record<TemplateVariable, string>): string {
  let filled = template;
  for (const name of VARIABLE_NAMES) {
    filled = filled.split(name).join(values[name]);
  }

  /* Le repli du prénom absent : « Hello , » redevient « Hello, », et
     « Hello  » redevient « Hello ». Deux passes, parce que le premier motif
     laisse un espace que le second ramasse. */
  return filled
    .replace(/[ \t]+,/g, ",")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+$/gm, "");
}

/**
 * Remplit l'objet et le corps d'un mail.
 *
 * Les deux modèles sont vérifiés ensemble : une variable inconnue dans l'un
 * suffit à tout arrêter, parce qu'un mail à moitié juste part quand même.
 */
export function renderEmail(
  subjectTemplate: string,
  bodyTemplate: string,
  facts: TemplateFacts,
): RenderedEmail {
  const unknown = [
    ...new Set([
      ...unknownVariablesIn(subjectTemplate),
      ...unknownVariablesIn(bodyTemplate),
    ]),
  ];
  if (unknown.length > 0) return { ok: false, unknownVariables: unknown };

  const values = valuesOf(facts);
  return {
    ok: true,
    /* L'objet tient sur une ligne, quoi qu'on ait tapé dedans. */
    subject: fill(subjectTemplate, values).replace(/\s*\n\s*/g, " ").trim(),
    body: fill(bodyTemplate, values).trimEnd(),
  };
}
