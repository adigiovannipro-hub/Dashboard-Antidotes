import { describe, expect, it } from "vitest";

import { deliveryTrack, isEngagementSettled } from "./delivery";
import type { BillingEmailKind } from "./types";

const parti = (kind: BillingEmailKind, sentAt: string) => ({ kind, sent_at: sentAt });

/* Envoyée le 8 septembre 2026 : relances prévues les 9 octobre, 24 octobre
   et 8 novembre (J+31, J+46, J+61). */
const ENVOI = "2026-09-08T07:12:00.000Z";

describe("deliveryTrack", () => {
  it("ne suit rien tant que la facture n'est pas partie par l'envoi automatique", () => {
    expect(deliveryTrack([], new Date("2026-10-06T10:00:00.000Z"))).toBeNull();
    expect(
      deliveryTrack([parti("reminder_1", ENVOI)], new Date("2026-10-06T10:00:00.000Z")),
    ).toBeNull();
  });

  it("rend toujours quatre étapes, datées depuis l'envoi initial", () => {
    const track = deliveryTrack([parti("invoice", ENVOI)], new Date("2026-10-06T10:00:00.000Z"));
    expect(track?.steps.map((step) => [step.kind, step.dueOn])).toEqual([
      ["invoice", null],
      ["reminder_1", "2026-10-09"],
      ["reminder_2", "2026-10-24"],
      ["reminder_3", "2026-11-08"],
    ]);
    expect(track?.steps.map((step) => step.sentAt !== null)).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });

  it("annonce la première relance tant qu'elle n'est pas due", () => {
    const track = deliveryTrack([parti("invoice", ENVOI)], new Date("2026-10-06T10:00:00.000Z"));
    expect(track?.next).toEqual({ kind: "reminder_1", dueOn: "2026-10-09" });
    expect(track?.lastReminder).toBeNull();
  });

  it("dit la dernière relance partie et la suivante", () => {
    const track = deliveryTrack(
      [parti("invoice", ENVOI), parti("reminder_1", "2026-10-09T06:20:00.000Z")],
      new Date("2026-10-12T10:00:00.000Z"),
    );
    expect(track?.lastReminder?.kind).toBe("reminder_1");
    expect(track?.next).toEqual({ kind: "reminder_2", dueOn: "2026-10-24" });
  });

  it("annonce pour aujourd'hui une relance due que le passage n'a pas encore envoyée", () => {
    const track = deliveryTrack([parti("invoice", ENVOI)], new Date("2026-10-09T05:00:00.000Z"));
    expect(track?.next).toEqual({ kind: "reminder_1", dueOn: "2026-10-09" });
  });

  it("reprend à la dernière relance due, comme l'automate, sans rattraper les précédentes", () => {
    // Le 30 octobre, rien n'est parti depuis l'envoi : c'est la relance 2
    // qui partira, pas la 1.
    const track = deliveryTrack([parti("invoice", ENVOI)], new Date("2026-10-30T10:00:00.000Z"));
    expect(track?.next).toEqual({ kind: "reminder_2", dueOn: "2026-10-30" });
  });

  it("n'annonce plus rien après la troisième relance", () => {
    const track = deliveryTrack(
      [
        parti("invoice", ENVOI),
        parti("reminder_1", "2026-10-09T06:00:00.000Z"),
        parti("reminder_2", "2026-10-24T06:00:00.000Z"),
        parti("reminder_3", "2026-11-08T06:00:00.000Z"),
      ],
      new Date("2026-11-20T10:00:00.000Z"),
    );
    expect(track?.next).toBeNull();
    expect(track?.lastReminder?.kind).toBe("reminder_3");
    expect(track?.steps.every((step) => step.sentAt !== null)).toBe(true);
  });
});

describe("isEngagementSettled", () => {
  it("est soldé quand tout est payé", () => {
    expect(isEngagementSettled([{ status: "paid" }, { status: "paid" }])).toBe(true);
  });

  it("compte un mois passé comme réglé", () => {
    expect(isEngagementSettled([{ status: "paid" }, { status: "skipped" }])).toBe(true);
  });

  it("ne l'est pas tant qu'une facture attend son règlement ou son émission", () => {
    expect(isEngagementSettled([{ status: "paid" }, { status: "issued" }])).toBe(false);
    expect(isEngagementSettled([{ status: "paid" }, { status: "pending" }])).toBe(false);
  });

  it("ne l'est pas sans rien d'encaissé", () => {
    expect(isEngagementSettled([])).toBe(false);
    expect(isEngagementSettled([{ status: "skipped" }])).toBe(false);
  });
});
