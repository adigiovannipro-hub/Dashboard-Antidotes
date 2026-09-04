import { z } from "zod";

/**
 * Les formulaires du module Factures, validés à la frontière.
 *
 * Ils vivent ici et non dans `src/app/actions/billing.ts` pour une raison
 * précise : un fichier `"use server"` ne peut exporter que des fonctions
 * asynchrones, donc rien de ce qu'il contient n'est testable directement. Ce
 * schéma-là l'a payé cher — il exigeait trois champs que le formulaire
 * n'envoyait pas sous ce nom, la validation échouait à tous les coups, et le
 * message d'erreur accusait le destinataire. Un test de dix lignes l'aurait
 * vu ; encore fallait-il pouvoir l'écrire.
 *
 * Règle à tenir : **tout champ ajouté au panneau se déclare ici**, et le test
 * colocalisé vérifie qu'un formulaire complet passe.
 */

/* Le formulaire parle en euros, la base en centimes. La virgule française
   est admise : « 2500,50 » vaut 2 500,50 €. */
export const frenchAmount = z
  .string()
  .trim()
  .min(1)
  .transform((value) => Number(value.replace(/\s/g, "").replace(",", ".")))
  .pipe(z.number().positive().finite());

/* `<input type="month">` envoie `AAAA-MM` : on cale au 1er. */
export const isoMonth = z
  .string()
  .regex(/^\d{4}-\d{2}$/)
  .transform((value) => `${value}-01`);

const optionalEmail = z
  .string()
  .trim()
  .refine((value) => value === "" || /^[^@\s]+@[^@\s]+$/.test(value), {
    message: "adresse invalide",
  });

/* Une liste d'adresses saisie à la main : virgules, points-virgules, sauts de
   ligne, espaces — tout ce qu'un copier-coller depuis un client de messagerie
   peut produire. */
export const emailList = z
  .string()
  .trim()
  .transform((value) =>
    value
      .split(/[,;\n]/)
      .map((address) => address.trim())
      .filter(Boolean),
  )
  .refine(
    (addresses) => addresses.every((address) => /^[^@\s]+@[^@\s]+$/.test(address)),
    { message: "adresse invalide" },
  );

/** Ce que le panneau porte hors période et montants — commun aux deux modes. */
const ficheShape = {
  /* Vide = automatisme désactivé pour ce client. C'est le seul interrupteur,
     et c'est délibéré : il se lit d'un coup d'œil sur la fiche du devis. */
  recipientEmail: optionalEmail,
  ccEmails: emailList,
  contactFirstName: z.string().trim().max(100),

  billingName: z.string().trim().max(200),
  billingEmail: optionalEmail,
  billingStreet: z.string().trim().max(200),
  billingCity: z.string().trim().max(120),
  billingPostcode: z.string().trim().max(20),
  billingCountry: z.string().trim().max(2),
  billingTaxId: z.string().trim().max(40),
  productName: z.string().trim().max(200),

  templateInvoiceId: z.string().trim().max(100),
  sendSubject: z.string().trim().max(300),
  sendTemplate: z.string().trim().max(5000),
  reminder1Subject: z.string().trim().max(300),
  reminder1Template: z.string().trim().max(5000),
  reminder2Subject: z.string().trim().max(300),
  reminder2Template: z.string().trim().max(5000),
  reminder3Subject: z.string().trim().max(300),
  reminder3Template: z.string().trim().max(5000),
} as const;

/** Les noms des champs de la fiche, tels que le formulaire les envoie. */
export const FICHE_FIELDS = Object.keys(ficheShape) as (keyof typeof ficheShape)[];

export const deliveryInput = z.object({
  engagementId: z.uuid(),
  ...ficheShape,
});

export const createEngagementInput = z
  .object({
    clientName: z.string().trim().min(1).max(200),
    label: z.string().trim().min(1).max(200),
    firstMonth: isoMonth,
    lastMonth: isoMonth,
    /* L'un des deux suffit : le total se divise, le mensuel se multiplie. */
    totalAmount: frenchAmount.optional(),
    monthlyAmount: frenchAmount.optional(),
    vatRate: z
      .string()
      .trim()
      .transform((value) => Number(value.replace(",", ".")))
      .pipe(z.number().min(0).max(100)),
    notes: z.string().trim().max(2000).optional(),
    ...ficheShape,
  })
  .refine((data) => data.totalAmount || data.monthlyAmount, {
    message: "montant absent",
  })
  .refine((data) => data.lastMonth >= data.firstMonth, {
    message: "période inversée",
  });

/**
 * Les valeurs de la fiche, lues d'un `FormData`.
 *
 * Une seule fonction pour les deux formulaires : le bug d'origine venait
 * précisément de deux listes de champs tenues à la main, qui ont divergé.
 */
export function ficheFrom(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    FICHE_FIELDS.map((field) => [field, String(formData.get(field) ?? "")]),
  );
}

/**
 * Les colonnes de `billing_engagements`, depuis une fiche validée.
 *
 * Une seule traduction pour la création comme pour la modification : c'est ce
 * qui garantit qu'un champ ajouté au panneau finit bien en base des deux
 * côtés. Vide devient `null` — un modèle vide, c'est « prendre celui du
 * code », pas « envoyer un mail vide ».
 */
export type Fiche = Omit<z.infer<typeof deliveryInput>, "engagementId">;

export function ficheColumns(fiche: Fiche) {
  return {
    recipient_email: fiche.recipientEmail || null,
    cc_emails: fiche.ccEmails,
    contact_first_name: fiche.contactFirstName || null,

    billing_name: fiche.billingName || null,
    billing_email: fiche.billingEmail || null,
    billing_street: fiche.billingStreet || null,
    billing_city: fiche.billingCity || null,
    billing_postcode: fiche.billingPostcode || null,
    billing_country: (fiche.billingCountry || "FR").toUpperCase(),
    billing_tax_id: fiche.billingTaxId || null,
    product_name: fiche.productName || null,

    template_invoice_external_id: fiche.templateInvoiceId || null,
    send_subject: fiche.sendSubject || null,
    send_template: fiche.sendTemplate || null,
    reminder_1_subject: fiche.reminder1Subject || null,
    reminder_1_template: fiche.reminder1Template || null,
    reminder_2_subject: fiche.reminder2Subject || null,
    reminder_2_template: fiche.reminder2Template || null,
    reminder_3_subject: fiche.reminder3Subject || null,
    reminder_3_template: fiche.reminder3Template || null,
  };
}

/**
 * Ce qui n'a pas passé la validation, en clair.
 *
 * « Adresse invalide » sur une erreur de longueur de modèle envoie chercher
 * au mauvais endroit : le message nomme le champ.
 */
export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Formulaire invalide.";
  const champ = issue.path.join(".") || "formulaire";
  return `${champ} : ${issue.message}`;
}
