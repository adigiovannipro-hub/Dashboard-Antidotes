import { describe, expect, it } from "vitest";

import { evaluateMonthSlot, type MonthSlotRow } from "./month-slot";

const ligne = (patch: Partial<MonthSlotRow> = {}): MonthSlotRow => ({
  id: "3f8d0b1e-0000-4000-8000-000000000001",
  deleted_at: null,
  ...patch,
});

describe("evaluateMonthSlot", () => {
  it("crée le mois quand la base n'en porte aucune ligne", () => {
    expect(evaluateMonthSlot(null)).toEqual({ action: "insert" });
    expect(evaluateMonthSlot(undefined)).toEqual({ action: "insert" });
  });

  it("relève le mois parti à la corbeille plutôt que d'en insérer un second", () => {
    const slot = evaluateMonthSlot(ligne({ deleted_at: "2026-09-01T10:00:00Z" }));

    expect(slot).toEqual({
      action: "restore",
      monthId: "3f8d0b1e-0000-4000-8000-000000000001",
    });
  });

  it("ne touche pas à un mois déjà au tableau", () => {
    const slot = evaluateMonthSlot(ligne());

    expect(slot).toEqual({
      action: "keep",
      monthId: "3f8d0b1e-0000-4000-8000-000000000001",
    });
  });
});
