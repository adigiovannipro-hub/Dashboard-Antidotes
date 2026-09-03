import { describe, expect, it } from "vitest";

import { buildInvoiceMime, type InvoiceMessage } from "./mime";

const message = (overrides: Partial<InvoiceMessage> = {}): InvoiceMessage => ({
  from: "a.digiovanni.pro@gmail.com",
  to: "contact@bondet.fr",
  cc: [],
  bcc: "a.digiovanni.pro@gmail.com",
  subject: "Facture INV-0005 — août 2026",
  body: "Bonjour Jean,\n\nVoici la facture.",
  attachment: { filename: "facture-INV-0005.pdf", content: Buffer.from("%PDF-1.4 x") },
  ...overrides,
});

describe("buildInvoiceMime", () => {
  it("porte les trois familles de destinataires", () => {
    const mime = buildInvoiceMime(
      message({ cc: ["compta@bondet.fr", "direction@bondet.fr"] }),
    );
    expect(mime).toContain("To: contact@bondet.fr");
    expect(mime).toContain("Cc: compta@bondet.fr, direction@bondet.fr");
    expect(mime).toContain("Bcc: a.digiovanni.pro@gmail.com");
  });

  it("omet la ligne Cc quand il n'y a personne en copie", () => {
    expect(buildInvoiceMime(message())).not.toContain("Cc:");
  });

  it("encode un objet accentué plutôt que de l'envoyer en clair", () => {
    const mime = buildInvoiceMime(message({ subject: "Facture réglée" }));
    expect(mime).toContain("Subject: =?UTF-8?B?");
    expect(mime).not.toContain("Subject: Facture réglée");
  });

  it("refuse l'injection d'en-tête par un objet de mail", () => {
    // Un modèle est éditable : un saut de ligne dedans ne doit pas devenir un
    // en-tête, et surtout pas un second Bcc.
    const mime = buildInvoiceMime(
      message({ subject: "Facture\r\nBcc: voleur@ailleurs.com" }),
    );
    // Le texte survit — aplati sur la ligne de l'objet, où il est inoffensif —
    // mais il n'y a toujours qu'un seul en-tête Bcc, le nôtre.
    expect(mime.match(/^Bcc:/gm)).toHaveLength(1);
    expect(mime).toContain("Subject: Facture Bcc: voleur@ailleurs.com");
  });

  it("joint le PDF en base64 sous un nom de fichier assaini", () => {
    const mime = buildInvoiceMime(
      message({
        attachment: {
          filename: "facture août/2026.pdf",
          content: Buffer.from("%PDF-1.4"),
        },
      }),
    );
    expect(mime).toContain('filename="facture_aout_2026.pdf"');
    expect(mime).toContain("Content-Type: application/pdf");
    expect(mime).toContain(Buffer.from("%PDF-1.4").toString("base64"));
  });

  it("place la facture entre le message et la carte de signature", () => {
    // L'ordre des parties est l'ordre d'affichage : un mail écrit à la main
    // se lit message, facture, carte de visite — pas l'inverse.
    const mime = buildInvoiceMime(
      message({
        body: "Bonjour,\n\nÀ dispo,",
        signature: { text: "Alessandro DI GIOVANNI", html: null },
      }),
    );

    const messagePos = mime.indexOf(
      Buffer.from("Bonjour,\n\nÀ dispo,", "utf8").toString("base64"),
    );
    const pdfPos = mime.indexOf("Content-Type: application/pdf");
    const signaturePos = mime.indexOf(
      Buffer.from("Alessandro DI GIOVANNI", "utf8").toString("base64"),
    );

    expect(messagePos).toBeGreaterThan(-1);
    expect(pdfPos).toBeGreaterThan(messagePos);
    expect(signaturePos).toBeGreaterThan(pdfPos);
  });

  it("propose la facture en affichage direct plutôt qu'en pièce détachée", () => {
    expect(buildInvoiceMime(message())).toContain("Content-Disposition: inline;");
  });

  it("part en texte simple quand aucune pièce n'est jointe", () => {
    const mime = buildInvoiceMime(message({ attachment: null }));
    expect(mime).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(mime).not.toContain("multipart/mixed");
  });
});
