/**
 * Les mails de facturation : leurs modèles, et le remplissage des variables.
 *
 * Module **pur** — aucune base, aucun réseau. Il rend un objet et un corps à
 * partir d'un modèle et de faits ; l'envoi est ailleurs (`envoi.ts`).
 *
 * Convention d'écriture d'un modèle, et c'est la seule à retenir :
 * **la première ligne est l'objet du mail, le reste est le corps.** Un champ
 * unique se relit d'un coup d'œil et se modifie dans une simple zone de
 * texte ; deux champs séparés auraient doublé le formulaire pour un gain nul.
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

/** Les variables qu'un modèle peut porter, et ce qu'elles disent. */
export const TEMPLATE_VARIABLES = {
  "[prénom]": "Le prénom du contact — « Jean ». Vide, la formule se replie.",
  "[client]": "Le nom du client — « Bondet ».",
  "[projet]": "L'intitulé de la prestation — « Accompagnement social media ».",
  "[période]": "Le mois de prestation facturé — « août 2026 ».",
  "[montant]": "Le montant TTC de la facture — « 2 522,50 € ».",
  "[numéro]": "Le numéro de la facture chez Airwallex — « INV-A9DFDGZ3-0005 ».",
  "[échéance]": "La date limite de règlement — « 5 septembre 2026 ».",
} as const;

export type TemplateVariable = keyof typeof TEMPLATE_VARIABLES;

const VARIABLE_NAMES = Object.keys(TEMPLATE_VARIABLES) as TemplateVariable[];

/**
 * Le modèle d'envoi par défaut.
 *
 * Court, factuel, sans formule creuse : il accompagne une pièce jointe, il
 * n'a rien à vendre. Le PDF porte le détail, le mail porte la politesse.
 */
export const DEFAULT_SEND_TEMPLATE = `Facture [numéro] — [projet] — [période]

Bonjour [prénom],

Vous trouverez ci-joint la facture [numéro] pour la période de [période], d'un montant de [montant].

Le règlement est attendu pour le [échéance].

Je reste à votre disposition.

Bien à vous,
Alessandro Di Giovanni
Antidotes`;

/**
 * Le modèle de relance par défaut.
 *
 * Même ton que l'envoi : une relance n'est pas une mise en demeure, et les
 * trois qui partent ont volontairement le même texte — c'est la répétition
 * qui fait effet, pas la montée en agressivité.
 */
export const DEFAULT_REMINDER_TEMPLATE = `Relance — facture [numéro] — [période]

Bonjour [prénom],

Sauf erreur de ma part, la facture [numéro] du [période], d'un montant de [montant], échue le [échéance], n'a pas encore été réglée.

Je vous la remets en pièce jointe. Si le règlement est déjà parti, merci d'ignorer ce message.

Bien à vous,
Alessandro Di Giovanni
Antidotes`;

/** Les faits d'une facture, tels qu'un modèle peut les nommer. */
export type TemplateFacts = {
  firstName: string | null;
  clientName: string;
  projectLabel: string;
  /** Le mois de prestation, déjà formaté — « août 2026 ». */
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

function valuesOf(facts: TemplateFacts): Record<TemplateVariable, string> {
  return {
    "[prénom]": facts.firstName?.trim() ?? "",
    "[client]": facts.clientName,
    "[projet]": facts.projectLabel,
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

/**
 * Remplit un modèle.
 *
 * La première ligne devient l'objet ; les lignes vides qui la suivent sont
 * mangées, de sorte qu'un corps ne commence jamais par un blanc. Une formule
 * dont le prénom manque — « Bonjour , » — est recousue : la virgule orpheline
 * et l'espace en trop disparaissent.
 */
export function renderEmail(
  template: string,
  facts: TemplateFacts,
): RenderedEmail {
  const unknown = unknownVariablesIn(template);
  if (unknown.length > 0) return { ok: false, unknownVariables: unknown };

  const values = valuesOf(facts);
  let filled = template;
  for (const name of VARIABLE_NAMES) {
    filled = filled.split(name).join(values[name]);
  }

  /* Le repli du prénom absent : « Bonjour , » redevient « Bonjour, », et
     « Bonjour  » redevient « Bonjour ». Deux passes, parce que le premier
     motif laisse un espace que le second ramasse. */
  filled = filled
    .replace(/[ \t]+,/g, ",")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+$/gm, "");

  const lines = filled.split("\n");
  const subject = (lines[0] ?? "").trim();
  let index = 1;
  while (index < lines.length && lines[index]!.trim() === "") index += 1;
  const body = lines.slice(index).join("\n").trimEnd();

  return { ok: true, subject, body };
}
