import { describe, expect, it } from "vitest";

import { parseGrabReceipt, parseKnownReceipt } from "./known-receipts";

/* Extrait du vrai e-reçu du 25/09/2026, tel que Gmail le rend en texte. */
const GRAB_TEXT = [
  "| Selamat menikmati makanan Anda! |",
  "| TOTAL Rp 211700 | TANGGAL | WAKTU 25 Sep 26 14:17 +0800 |",
  "| Jenis Kendaraan: GrabFood |",
  "| | Detail Pembayaran: Visa : Rp 211700 | |",
  "| | Subtotal | Rp 169000 | |",
  "| | Biaya Pengiriman | Rp 22000 | |",
  "| | TOTAL (INCL. TAX) | Rp 211700 | |",
  "| | PPN | Rp 1556 | |",
].join("\n");

const grab = (overrides: Partial<Parameters<typeof parseGrabReceipt>[0]> = {}) => ({
  subject: "Your Grab E-Receipt",
  snippet:
    "Selamat menikmati makanan Anda! TOTAL Rp 211700 TANGGAL | WAKTU 25 Sep 26 14:17 +0800 Detail Pesanan",
  text: GRAB_TEXT,
  ...overrides,
});

describe("parseKnownReceipt", () => {
  it("ne lit que les mails de grab.com", () => {
    expect(
      parseKnownReceipt({ ...grab(), from_email: "no-reply@grab.com" })?.amount_cents,
    ).toBe(21_170_000);
    expect(parseKnownReceipt({ ...grab(), from_email: "billing@stripe.com" })).toBeNull();
  });
});

describe("parseGrabReceipt", () => {
  it("lit le total, la devise et la date locale du reçu", () => {
    const result = parseGrabReceipt(grab());
    expect(result).toMatchObject({
      kind: "receipt",
      merchant: "Grab",
      amount_cents: 21_170_000,
      currency: "IDR",
      document_date: "2026-09-25",
      confidence: 0.95,
    });
  });

  it("lit les séparateurs de milliers et les mois indonésiens", () => {
    const result = parseGrabReceipt(
      grab({
        snippet: "TOTAL Rp 1.211.700 TANGGAL | WAKTU 3 Des 26 09:05 +0800",
        text: "TOTAL (INCL. TAX) | Rp 1.211.700",
      }),
    );
    expect(result?.amount_cents).toBe(121_170_000);
    expect(result?.document_date).toBe("2026-12-03");
  });

  it("rend la main au modèle quand les deux totaux divergent", () => {
    expect(
      parseGrabReceipt(grab({ text: GRAB_TEXT.replace("| Rp 211700 | |", "| Rp 211000 | |") })),
    ).toBeNull();
  });

  it("rend la main au modèle sans date lisible", () => {
    expect(
      parseGrabReceipt(grab({ snippet: "TOTAL Rp 211700", text: "TOTAL (INCL. TAX) | Rp 211700" })),
    ).toBeNull();
  });

  it("ignore ce qui n'est pas un e-reçu", () => {
    expect(parseGrabReceipt(grab({ subject: "Promo GrabFood -50%" }))).toBeNull();
  });

  it("ignore un reçu dans une autre devise que la roupie", () => {
    expect(
      parseGrabReceipt(
        grab({ snippet: "TOTAL S$ 12.40 DATE | TIME 25 Sep 26 14:17 +0800", text: "TOTAL S$ 12.40" }),
      ),
    ).toBeNull();
  });
});
