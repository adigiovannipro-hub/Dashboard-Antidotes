import { describe, expect, it } from "vitest";

import { daysSince, decideEnvoi, type EnvoiContext, type SentEmail } from "./relances";

/* Le 15 octobre 2026 : trois mois et demi après un mois de prestation de
   juin, de quoi faire tomber les trois relances sans arithmétique mentale. */
const MAINTENANT = new Date("2026-10-15T09:00:00.000Z");

const contexte = (overrides: Partial<EnvoiContext> = {}): EnvoiContext => ({
  status: "pending",
  issue_on: "2026-07-01",
  airwallex_invoice_id: null,
  recipient_email: "contact@client.fr",
  sent: [],
  now: MAINTENANT,
  ...overrides,
});

const parti = (kind: SentEmail["kind"], sentAt: string): SentEmail => ({
  kind,
  sent_at: sentAt,
});

describe("daysSince", () => {
  it("compte des jours de calendrier, pas des tranches de 24 heures", () => {
    // Parti le 1er à 23 h, on regarde le 2 à 1 h : un jour au calendrier.
    expect(
      daysSince("2026-07-01T23:00:00.000Z", new Date("2026-07-02T01:00:00.000Z")),
    ).toBe(1);
  });

  it("rend zéro le jour même", () => {
    expect(
      daysSince("2026-07-01T08:00:00.000Z", new Date("2026-07-01T20:00:00.000Z")),
    ).toBe(0);
  });

  it("ne s'effondre pas sur un horodatage illisible", () => {
    expect(daysSince("pas une date", MAINTENANT)).toBe(0);
  });
});

describe("decideEnvoi", () => {
  it("émet la facture quand le mois est fini et que rien n'est parti", () => {
    expect(decideEnvoi(contexte())).toEqual({ action: "emettre", kind: "invoice" });
  });

  it("envoie sans créer quand la facture existe déjà chez Airwallex", () => {
    // Le cas de la facture créée à la main, et celui d'un passage qui avait
    // planté juste après la création : dans les deux cas, ne pas en créer une
    // seconde.
    expect(
      decideEnvoi(contexte({ airwallex_invoice_id: "inv_abc", status: "issued" })),
    ).toEqual({ action: "envoyer", kind: "invoice" });
  });

  it("ne crée rien pour une mensualité déjà facturée hors du dispositif", () => {
    // Les mensualités reprises du board Monday portent « issued » sans aucune
    // facture Airwallex rattachée. En créer une serait facturer deux fois la
    // même prestation — le défaut que la première simulation a révélé.
    expect(
      decideEnvoi(contexte({ status: "issued", airwallex_invoice_id: null })),
    ).toEqual({ action: "rien", reason: "facturee_hors_dispositif" });
  });

  it("ne touche pas à un mois de prestation encore en cours", () => {
    expect(decideEnvoi(contexte({ issue_on: "2026-11-01" }))).toEqual({
      action: "rien",
      reason: "pas_encore_echue",
    });
  });

  it("s'abstient quand le devis ne porte aucune adresse", () => {
    expect(decideEnvoi(contexte({ recipient_email: null }))).toEqual({
      action: "rien",
      reason: "sans_destinataire",
    });
  });

  it("arrête tout dès que la facture est réglée", () => {
    // Même avec trois relances dues : le règlement passe avant le calendrier.
    expect(
      decideEnvoi(
        contexte({
          status: "paid",
          sent: [parti("invoice", "2026-07-01T08:00:00.000Z")],
        }),
      ),
    ).toEqual({ action: "rien", reason: "deja_payee" });
  });

  it("ignore une mensualité annulée", () => {
    expect(decideEnvoi(contexte({ status: "skipped" }))).toEqual({
      action: "rien",
      reason: "annulee",
    });
  });

  it("attend trente et un jours avant la première relance", () => {
    const envoi = parti("invoice", "2026-09-15T08:00:00.000Z"); // J+30 le 15/10
    expect(decideEnvoi(contexte({ status: "issued", sent: [envoi] }))).toEqual({
      action: "rien",
      reason: "envoyee_relance_a_venir",
    });
  });

  it("relance au trente et unième jour", () => {
    const envoi = parti("invoice", "2026-09-14T08:00:00.000Z"); // J+31 le 15/10
    expect(decideEnvoi(contexte({ status: "issued", sent: [envoi] }))).toEqual({
      action: "envoyer",
      kind: "reminder_1",
    });
  });

  it("enchaîne la deuxième relance quinze jours après la première", () => {
    const envoi = parti("invoice", "2026-08-30T08:00:00.000Z"); // J+46 le 15/10
    expect(
      decideEnvoi(
        contexte({
          status: "issued",
          sent: [envoi, parti("reminder_1", "2026-09-30T08:00:00.000Z")],
        }),
      ),
    ).toEqual({ action: "envoyer", kind: "reminder_2" });
  });

  it("enchaîne la troisième quinze jours après la deuxième", () => {
    const envoi = parti("invoice", "2026-08-15T08:00:00.000Z"); // J+61 le 15/10
    expect(
      decideEnvoi(
        contexte({
          status: "issued",
          sent: [
            envoi,
            parti("reminder_1", "2026-09-15T08:00:00.000Z"),
            parti("reminder_2", "2026-09-30T08:00:00.000Z"),
          ],
        }),
      ),
    ).toEqual({ action: "envoyer", kind: "reminder_3" });
  });

  it("patiente entre deux relances dues", () => {
    const envoi = parti("invoice", "2026-09-09T08:00:00.000Z"); // J+36 le 15/10
    expect(
      decideEnvoi(
        contexte({
          status: "issued",
          sent: [envoi, parti("reminder_1", "2026-10-10T08:00:00.000Z")],
        }),
      ),
    ).toEqual({ action: "rien", reason: "pas_encore_l_heure" });
  });

  it("se tait une fois les trois relances parties", () => {
    const envoi = parti("invoice", "2026-06-01T08:00:00.000Z");
    expect(
      decideEnvoi(
        contexte({
          status: "issued",
          sent: [
            envoi,
            parti("reminder_1", "2026-07-02T08:00:00.000Z"),
            parti("reminder_2", "2026-07-17T08:00:00.000Z"),
            parti("reminder_3", "2026-08-01T08:00:00.000Z"),
          ],
        }),
      ),
    ).toEqual({ action: "rien", reason: "relances_epuisees" });
  });

  it("ne rattrape pas les relances manquées, il reprend à la dernière due", () => {
    // Une facture laissée trois mois sans passage : un seul mail part, celui
    // du palier atteint — pas trois d'affilée le même matin.
    const envoi = parti("invoice", "2026-06-01T08:00:00.000Z"); // J+136
    expect(decideEnvoi(contexte({ status: "issued", sent: [envoi] }))).toEqual({
      action: "envoyer",
      kind: "reminder_3",
    });
  });
});
