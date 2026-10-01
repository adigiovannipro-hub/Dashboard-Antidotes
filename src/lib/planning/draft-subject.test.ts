import { describe, expect, it } from "vitest";

import { draftSubject, nextPosition, withDrafts } from "./draft-subject";
import type { PlanningLane, SubjectRow } from "./types";

const lane: PlanningLane = {
  id: "lane-1",
  month_id: "month-1",
  board_id: "board-1",
  workspace_id: "ws-1",
  platform: "meta",
  name: "META",
  position: 0,
  created_at: "2026-10-01T00:00:00Z",
};

const draft = (overrides: Partial<Parameters<typeof draftSubject>[0]> = {}) =>
  draftSubject({
    id: "new-1",
    lane,
    monthKey: "2026-10-01",
    position: 3,
    now: "2026-10-01T08:00:00Z",
    ...overrides,
  });

describe("draftSubject", () => {
  it("rattache la ligne à son couloir, son mois et son tableau", () => {
    expect(draft()).toMatchObject({
      id: "new-1",
      lane_id: "lane-1",
      month_id: "month-1",
      board_id: "board-1",
      workspace_id: "ws-1",
      platform: "meta",
      lane_name: "META",
      month_key: "2026-10-01",
      position: 3,
    });
  });

  it("prend les valeurs par défaut de la table", () => {
    expect(draft()).toMatchObject({
      name: "",
      status: "idea",
      format: "post",
      scheduled_on: null,
      wording: null,
      visual_urls: [],
      custom: {},
      comments: [],
      visuals: [],
    });
  });
});

describe("nextPosition", () => {
  it("suit la dernière ligne, quel que soit l'ordre", () => {
    expect(nextPosition([{ position: 4 }, { position: 1 }])).toBe(5);
  });

  it("commence à zéro dans un couloir vide", () => {
    expect(nextPosition([])).toBe(0);
  });
});

describe("withDrafts", () => {
  const server = (id: string) => ({ ...draft({ id }), name: "du serveur" }) as SubjectRow;

  it("ajoute les brouillons après les lignes du serveur", () => {
    expect(withDrafts([server("a")], [draft({ id: "b" })]).map((row) => row.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("ne double pas une ligne que le serveur a déjà rendue", () => {
    const rows = withDrafts([server("new-1")], [draft()]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe("du serveur");
  });
});
