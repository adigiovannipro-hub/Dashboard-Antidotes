import { describe, expect, it } from "vitest";

import {
  centsToCsvDecimal,
  formatDualAmount,
  formatMoney,
  formatMoneyCompact,
  NOT_AVAILABLE,
} from "./money";

/** `Intl` fr-FR sème des espaces insécables ; on les aplatit pour comparer. */
function flat(value: string): string {
  return value.replace(/[  ]/g, " ");
}

describe("formatMoney", () => {
  it("affiche l'euro avec son symbole", () => {
    expect(flat(formatMoney(773, "EUR"))).toBe("7,73 €");
  });

  it("affiche les autres devises avec leur code ISO", () => {
    expect(flat(formatMoney(15_880_000, "IDR"))).toBe("158 800 IDR");
    expect(flat(formatMoney(2050, "USD"))).toBe("20,50 USD");
  });

  it("respecte les décimales propres à chaque devise", () => {
    // L'IDR ne porte pas de décimales à l'affichage, l'euro en porte deux.
    expect(flat(formatMoney(100, "IDR"))).toBe("1 IDR");
    expect(flat(formatMoney(100, "EUR"))).toBe("1,00 €");
  });

  it("rend un tiret quand le montant ou la devise manquent", () => {
    expect(formatMoney(null, "EUR")).toBe(NOT_AVAILABLE);
    expect(formatMoney(1000, null)).toBe(NOT_AVAILABLE);
    expect(formatMoney(Number.NaN, "EUR")).toBe(NOT_AVAILABLE);
  });
});

describe("formatDualAmount", () => {
  it("sépare le montant local du montant débité", () => {
    const { primary, funded } = formatDualAmount({
      amount_cents: 15_880_000,
      currency: "IDR",
      billing_amount_cents: 773,
      billing_currency: "EUR",
    });
    expect(flat(primary)).toBe("158 800 IDR");
    expect(flat(funded ?? "")).toBe("7,73 €");
  });

  it("ne répète pas le montant quand la devise débitée est la même", () => {
    const { funded } = formatDualAmount({
      amount_cents: 999,
      currency: "EUR",
      billing_amount_cents: 999,
      billing_currency: "EUR",
    });
    expect(funded).toBeNull();
  });

  it("reste muet sur le débit quand Airwallex ne l'a pas encore fixé", () => {
    const { funded } = formatDualAmount({
      amount_cents: 15_880_000,
      currency: "IDR",
      billing_amount_cents: null,
      billing_currency: null,
    });
    expect(funded).toBeNull();
  });
});

describe("formatMoneyCompact", () => {
  it("abrège pour les axes", () => {
    expect(flat(formatMoneyCompact(1_234_500, "EUR"))).toBe("12,3 k€");
  });
});

describe("centsToCsvDecimal", () => {
  it("écrit la décimale à la française", () => {
    expect(centsToCsvDecimal(773)).toBe("7,73");
    expect(centsToCsvDecimal(15_880_000)).toBe("158800,00");
    expect(centsToCsvDecimal(0)).toBe("0,00");
  });
});
