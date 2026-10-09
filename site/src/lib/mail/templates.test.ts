import { describe, expect, it } from "vitest";

import { bookingConfirmation, bookingReminder, leadWelcome, ownerBooking, ownerQuestionnaire } from "./templates";

const start = new Date("2026-10-20T07:00:00.000Z");
const booking = {
  firstName: "Ana <b>",
  start,
  end: new Date("2026-10-20T07:30:00.000Z"),
  prospectTimeZone: "Europe/Paris",
  ownerTimeZone: "Asia/Makassar",
  meetUrl: "https://meet.jit.si/antidotes-12345678",
  icsUrl: "https://antidotes.agency/api/reservation/tok/ics",
  googleUrl: "https://calendar.google.com/x",
  cancelUrl: "https://antidotes.agency/rdv/tok",
};

describe("bookingConfirmation", () => {
  it("donne l'heure du prospect et celle de Bali, en français, sans HTML injecté", () => {
    const mail = bookingConfirmation("fr", booking);
    expect(mail.subject).toContain("09:00");
    expect(mail.html).toContain("09:00");
    expect(mail.html).toContain("15:00");
    expect(mail.html).toContain("Makassar");
    expect(mail.html).not.toContain("<b>");
    expect(mail.html).toContain("&lt;b&gt;");
    expect(mail.text).toContain("Annuler");
    expect(mail.html).toContain(booking.cancelUrl);
    expect(mail.html).toContain(booking.icsUrl);
  });

  it("existe en anglais, avec les deux fuseaux", () => {
    const mail = bookingConfirmation("en", booking);
    expect(mail.subject).toMatch(/call/i);
    expect(mail.html).toContain("for Alessandro");
    expect(mail.html).toContain("UTC+8");
  });

  it("dit que le lien arrive plus tard quand l'agenda n'est pas branché", () => {
    const mail = bookingConfirmation("fr", { ...booking, meetUrl: null });
    expect(mail.html).toContain("second courriel");
    expect(mail.html).not.toContain("meet.jit.si");
  });
});

describe("bookingReminder", () => {
  it("rappelle l'heure dans le fuseau du prospect", () => {
    const mail = bookingReminder("fr", booking);
    expect(mail.html).toContain("09:00");
    expect(mail.html).toContain("Paris");
  });
});

describe("la note ne part jamais au prospect", () => {
  it("les courriels prospect n'en parlent qu'en promesse", () => {
    const mails = [leadWelcome("fr", { firstName: "Ana", continueUrl: "https://antidotes.agency/?note=1" }), bookingConfirmation("fr", booking), bookingReminder("en", booking)];
    for (const mail of mails) {
      expect(mail.html).not.toMatch(/\d[,.]\d\s*\/\s*10/);
      expect(mail.text).not.toMatch(/\d[,.]\d\s*\/\s*10/);
    }
  });

  it("l'owner, lui, la reçoit avec la qualification", () => {
    const mail = ownerQuestionnaire({ email: "ana@example.com", firstName: "Ana", answers: { goal: "ventes", management: "agence" }, score: 7.5, temperature: "chaud" });
    expect(mail.html).toContain("7.5");
    expect(mail.subject).toMatch(/chaud/i);
    expect(mail.html).toContain("Une agence");
  });
});

describe("ownerBooking", () => {
  it("donne les deux heures, la qualification et le repli d'agenda", () => {
    const mail = ownerBooking({
      email: "ana@example.com",
      name: "Ana Martin",
      company: "Maison Ana",
      phone: null,
      notes: "Lancement en novembre",
      start,
      prospectTimeZone: "Europe/Paris",
      ownerTimeZone: "Asia/Makassar",
      meetUrl: "https://meet.jit.si/antidotes-12345678",
      calendarCreated: false,
      answers: { goal: "ventes" },
      score: 4.7,
      temperature: "tiede",
      cancelUrl: "https://antidotes.agency/rdv/tok",
    });
    expect(mail.subject).toContain("15:00");
    expect(mail.html).toContain("09:00");
    expect(mail.html).toContain("4.7");
    expect(mail.html).toContain("n'est pas branché");
    expect(mail.html).toContain("Lancement en novembre");
  });
});

describe("layout", () => {
  it("porte la palette verte : filet vert avec repli plein, liens en forêt, plus aucune teinte irisée", () => {
    const html = bookingConfirmation("fr", booking).html + leadWelcome("en", { firstName: "Ana", continueUrl: "https://antidotes.agency" }).html;
    expect(html).toContain('bgcolor="#22E05B"');
    expect(html).toContain("#0F6529");
    expect(html).not.toMatch(/7fd9ff|8d7bff|ff6fae|ffb866/i);
    expect(html).not.toMatch(/<a href="[^"]*">/);
    expect(html).toContain('<a style="color:#0E4A26;text-decoration:underline" href="https://antidotes.agency/rdv/tok"');
  });
});
