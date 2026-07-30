import { describe, expect, it } from "vitest";

import {
  can,
  canSendWithoutApproval,
  hasClientAccess,
  isModerationVisible,
  NO_ACCESS,
  type ModerationAccess,
} from "./permissions";

describe("capacités par rôle", () => {
  it("l'owner a tout", () => {
    for (const capability of [
      "conversation.delete",
      "connections.manage",
      "autosend.manage",
      "members.manage",
      "monday.import",
      "audit.read_all_clients",
      "purge.run",
    ] as const) {
      expect(can("owner", capability)).toBe(true);
    }
  });

  it("l'opérateur lit, génère, corrige et envoie", () => {
    expect(can("operator", "conversation.read")).toBe(true);
    expect(can("operator", "conversation.reply")).toBe(true);
    expect(can("operator", "conversation.ignore")).toBe(true);
    expect(can("operator", "conversation.snooze")).toBe(true);
    expect(can("operator", "faq.write")).toBe(true);
    expect(can("operator", "faq.rollback")).toBe(true);
  });

  it("l'opérateur ne touche ni aux connexions API, ni à l'auto-envoi, ni aux accès", () => {
    expect(can("operator", "connections.manage")).toBe(false);
    expect(can("operator", "autosend.manage")).toBe(false);
    expect(can("operator", "members.manage")).toBe(false);
    expect(can("operator", "monday.import")).toBe(false);
    expect(can("operator", "purge.run")).toBe(false);
    expect(can("operator", "conversation.delete")).toBe(false);
  });

  it("l'opérateur n'accède pas au journal global", () => {
    // Il voit le journal de ses propres clients, jamais celui des autres.
    expect(can("operator", "audit.read")).toBe(true);
    expect(can("operator", "audit.read_all_clients")).toBe(false);
  });

  it("le lecteur ne peut rien modifier", () => {
    expect(can("viewer", "conversation.read")).toBe(true);
    expect(can("viewer", "faq.read")).toBe(true);
    expect(can("viewer", "conversation.reply")).toBe(false);
    expect(can("viewer", "faq.write")).toBe(false);
  });
});

describe("validation admin avant envoi", () => {
  it("un opérateur soumis à validation ne peut pas envoyer seul", () => {
    expect(canSendWithoutApproval("operator", true)).toBe(false);
    expect(canSendWithoutApproval("operator", false)).toBe(true);
  });

  it("l'owner n'est jamais soumis à validation", () => {
    expect(canSendWithoutApproval("owner", true)).toBe(true);
  });

  it("un lecteur ne peut pas envoyer, même sans exigence de validation", () => {
    expect(canSendWithoutApproval("viewer", false)).toBe(false);
  });
});

describe("cloisonnement entre clients", () => {
  const bondetOnly: ModerationAccess = {
    role: "operator",
    clientIds: ["client-bondet"],
    requiresApprovalByClient: { "client-bondet": false },
  };

  it("un opérateur rattaché à Bondet n'atteint pas un autre client", () => {
    expect(hasClientAccess(bondetOnly, "client-bondet")).toBe(true);
    expect(hasClientAccess(bondetOnly, "client-iway")).toBe(false);
  });

  it("le module reste invisible pour qui n'a aucun client rattaché", () => {
    // C'est le cas de tous les clients du dashboard de reporting : ils ne
    // doivent pas même savoir que le module existe.
    expect(isModerationVisible(NO_ACCESS)).toBe(false);
    expect(isModerationVisible(bondetOnly)).toBe(true);
  });

  it("un accès vide ne confère aucune capacité utile", () => {
    expect(NO_ACCESS.clientIds).toEqual([]);
    expect(can(NO_ACCESS.role, "conversation.reply")).toBe(false);
  });
});
