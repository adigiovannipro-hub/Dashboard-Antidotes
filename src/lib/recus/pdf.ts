import "server-only";

import type { GmailAttachment } from "./gmail";

/**
 * Obtention de la pièce à transférer.
 *
 * Trois cas, par ordre de préférence :
 *
 *   1. **un PDF est déjà joint au mail.** C'est le cas le plus fréquent et le
 *      meilleur : le document est celui du fournisseur, avec sa mise en page et
 *      ses mentions légales. On le transmet tel quel.
 *
 *   2. **la facture est dans le corps du message.** On la rend en PDF. Beaucoup
 *      d'outils SaaS n'envoient rien d'autre qu'un mail HTML.
 *
 *   3. **le rendu n'est pas disponible.** On transfère le mail en texte, sans
 *      pièce jointe : l'OCR d'Airwallex sait lire un corps de message, et c'est
 *      d'ailleurs ainsi que fonctionne leur propre règle de transfert Gmail.
 *
 * Le troisième cas n'est pas un échec. Le rendu HTML vers PDF demande un
 * navigateur sans interface, que tous les hébergements ne fournissent pas ;
 * refuser de traiter la pièce faute de navigateur ferait perdre un justificatif
 * pour une raison purement technique.
 */

export type ReceiptFile =
  | {
      origin: "attachment";
      filename: string;
      contentType: string;
      content: Buffer;
      /** Identifiant Gmail, pour retélécharger sans refaire l'analyse. */
      externalAttachmentId: string;
    }
  | { origin: "rendered"; filename: string; contentType: string; content: Buffer }
  | { origin: "none" };

const PDF_NAME = /\.pdf$/i;

/**
 * Choisit la pièce jointe qui porte la facture.
 *
 * Le plus gros PDF plutôt que le premier : les mails de facturation joignent
 * volontiers un logo ou une signature en PDF de quelques kilo-octets à côté du
 * document réel.
 */
export function pickInvoiceAttachment(
  attachments: GmailAttachment[],
): GmailAttachment | null {
  const pdfs = attachments.filter(
    (attachment) =>
      PDF_NAME.test(attachment.filename) || attachment.mimeType === "application/pdf",
  );
  if (pdfs.length === 0) return null;

  return pdfs.reduce((largest, current) =>
    current.size > largest.size ? current : largest,
  );
}

/** Taille au-delà de laquelle Airwallex refuse la pièce. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/**
 * Le strict nécessaire de l'API Playwright.
 *
 * Décrit localement plutôt qu'importé : le paquet est une dépendance de
 * développement, et un `import` typé le ferait entrer dans le graphe du build
 * de production — plusieurs centaines de mégaoctets pour une fonctionnalité
 * facultative.
 */
type BrowserLauncher = {
  chromium: {
    launch: () => Promise<{
      newPage: () => Promise<{
        setContent: (html: string, options: object) => Promise<void>;
        pdf: (options: object) => Promise<Uint8Array>;
      }>;
      close: () => Promise<void>;
    }>;
  };
};

/**
 * Rend un corps HTML en PDF avec Playwright, s'il est disponible.
 *
 * Le spécificateur est construit à l'exécution : le bundler ne peut pas le
 * résoudre statiquement, donc ne l'embarque pas. Absent, le `catch` rend `null`
 * et l'appelant retombe sur le transfert en texte — un hébergement sans
 * navigateur reste parfaitement utilisable.
 */
export async function renderHtmlToPdf(html: string): Promise<Buffer | null> {
  try {
    const specifier = "play" + "wright";
    const { chromium } = (await import(
      /* webpackIgnore: true */ /* @vite-ignore */ specifier
    )) as BrowserLauncher;
    const browser = await chromium.launch();

    try {
      const page = await browser.newPage();

      /* `domcontentloaded` et non `networkidle` : les mails de facturation
         embarquent des pixels de suivi qui ne répondent jamais, et attendre le
         silence réseau ferait expirer chaque rendu. */
      await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 15_000 });

      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  } catch {
    /* Playwright absent, navigateur non installé, rendu en échec : dans tous
       les cas le mail partira en texte. Ce n'est pas une erreur à propager. */
    return null;
  }
}

/** Nom de fichier lisible dans la boîte de reçus d'Airwallex. */
export function receiptFilename(options: {
  merchant: string | null;
  documentDate: string | null;
  invoiceNumber: string | null;
}): string {
  const parts = [
    options.documentDate ?? new Date().toISOString().slice(0, 10),
    options.merchant ?? "facture",
    options.invoiceNumber,
  ].filter((part): part is string => Boolean(part));

  return `${parts.join("-").replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 100)}.pdf`;
}
