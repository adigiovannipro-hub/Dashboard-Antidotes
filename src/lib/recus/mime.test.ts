import { describe, expect, it } from "vitest";

import { buildForwardMime, encodeHeader, type ForwardMessage } from "./mime";

const message = (overrides: Partial<ForwardMessage> = {}): ForwardMessage => ({
  from: "a.digiovanni.pro@gmail.com",
  to: "receipts@expenses.airwallex.com",
  subject: "Votre facture Notion",
  originalBody: "Merci pour votre paiement.",
  attachment: {
    filename: "facture.pdf",
    contentType: "application/pdf",
    content: Buffer.from("%PDF-1.4 fake"),
  },
  summary: {
    merchant: "Notion Labs",
    amount: "15,00 €",
    date: "2026-07-12",
    invoiceNumber: "INV-42",
  },
  ...overrides,
});

const decodeBase64Body = (mime: string, afterMarker: string): string => {
  const section = mime.slice(mime.indexOf(afterMarker));
  const body = section.split("\r\n\r\n")[1] ?? "";
  const encoded = body.split("\r\n--")[0]!.replace(/\r\n/g, "");
  return Buffer.from(encoded, "base64").toString("utf8");
};

describe("encodeHeader", () => {
  it("laisse l'ASCII intact", () => {
    expect(encodeHeader("Invoice 42")).toBe("Invoice 42");
  });

  it("encode les accents en RFC 2047", () => {
    const encoded = encodeHeader("Facture réglée");
    expect(encoded).toMatch(/^=\?UTF-8\?B\?/);
    const payload = encoded.slice("=?UTF-8?B?".length, -2);
    expect(Buffer.from(payload, "base64").toString("utf8")).toBe("Facture réglée");
  });
});

describe("buildForwardMime", () => {
  it("adresse le message à la boîte de reçus depuis l'adresse connectée", () => {
    // Airwallex rejette un reçu qui ne vient pas de l'adresse rattachée au
    // compte : cet en-tête n'est pas cosmétique.
    const mime = buildForwardMime(message());
    expect(mime).toContain("From: a.digiovanni.pro@gmail.com");
    expect(mime).toContain("To: receipts@expenses.airwallex.com");
  });

  it("répète les données extraites en clair pour l'OCR", () => {
    const body = decodeBase64Body(buildForwardMime(message()), "text/plain");
    expect(body).toContain("Fournisseur : Notion Labs");
    expect(body).toContain("Montant : 15,00 €");
    expect(body).toContain("Date : 2026-07-12");
    expect(body).toContain("Numéro de facture : INV-42");
  });

  it("joint le PDF en base64 avec son nom", () => {
    const mime = buildForwardMime(message());
    expect(mime).toContain("Content-Type: multipart/mixed");
    expect(mime).toContain('Content-Disposition: attachment; filename="facture.pdf"');
    expect(mime).toContain(
      Buffer.from("%PDF-1.4 fake").toString("base64"),
    );
  });

  it("part en texte simple quand il n'y a pas de pièce jointe", () => {
    const mime = buildForwardMime(message({ attachment: null }));
    expect(mime).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(mime).not.toContain("multipart/mixed");
  });

  it("replie le base64 à 76 colonnes", () => {
    const mime = buildForwardMime(
      message({
        attachment: {
          filename: "gros.pdf",
          contentType: "application/pdf",
          content: Buffer.alloc(5000, 0x41),
        },
      }),
    );
    const longest = Math.max(...mime.split("\r\n").map((line) => line.length));
    expect(longest).toBeLessThanOrEqual(998); // limite dure de la RFC 5322
  });

  it("neutralise une injection d'en-tête glissée dans le sujet", () => {
    // Le sujet vient de l'extérieur. Sans nettoyage, ce `\r\n` créerait un
    // véritable en-tête `Bcc:` et enverrait la facture à un tiers. Le texte
    // peut rester — c'est le passage à la ligne qui est dangereux, donc on
    // vérifie qu'aucune ligne ne *commence* par un en-tête injecté.
    const mime = buildForwardMime(
      message({ subject: "Facture\r\nBcc: voleur@example.com" }),
    );

    const headerLines = mime.split("\r\n\r\n")[0]!.split("\r\n");
    expect(headerLines.some((line) => /^bcc:/i.test(line))).toBe(false);
    expect(headerLines.filter((line) => /^subject:/i.test(line))).toHaveLength(1);
  });

  it("réduit un nom de pièce jointe hostile à des caractères sûrs", () => {
    const mime = buildForwardMime(
      message({
        attachment: {
          filename: 'x".pdf\r\nX-Injected: 1',
          contentType: "application/pdf",
          content: Buffer.from("a"),
        },
      }),
    );

    const headerLines = mime.split("\r\n");
    expect(headerLines.some((line) => /^x-injected:/i.test(line))).toBe(false);
    // Le paramètre `filename` ne contient plus ni guillemet ni deux-points.
    expect(mime).toContain('filename="x_.pdf_X-Injected_1"');
  });

  it("tronque un corps interminable", () => {
    const mime = buildForwardMime(
      message({ originalBody: "a".repeat(50_000), attachment: null }),
    );
    const body = decodeBase64Body(mime, "text/plain");
    expect(body.length).toBeLessThan(5000);
  });

  it("omet les lignes de résumé absentes plutôt que d'écrire null", () => {
    const body = decodeBase64Body(
      buildForwardMime(
        message({
          summary: {
            merchant: null,
            amount: "12,00 €",
            date: null,
            invoiceNumber: null,
          },
        }),
      ),
      "text/plain",
    );
    expect(body).not.toContain("null");
    expect(body).toContain("Montant : 12,00 €");
  });
});
