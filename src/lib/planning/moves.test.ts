import { describe, expect, it } from "vitest";

import { applyMoves, type PendingMove } from "./moves";
import type { SubjectRow } from "./types";

const row = (id: string, lane_id = "a"): SubjectRow => ({ id, lane_id }) as unknown as SubjectRow;
const ids = (rows: SubjectRow[]) => rows.map((r) => r.id);
const move = (subjectId: string, laneId: string, index: number, from = "a"): PendingMove => ({
  subjectId,
  laneId,
  index,
  row: row(subjectId, from),
});

describe("applyMoves", () => {
  it("rend la liste telle quelle sans déplacement", () => {
    const list = [row("1"), row("2")];
    expect(applyMoves("a", list, [])).toBe(list);
  });

  it("descend une ligne dans son couloir, rang compté sans elle", () => {
    const list = [row("1"), row("2"), row("3")];
    expect(ids(applyMoves("a", list, [move("1", "a", 2)]))).toEqual(["2", "3", "1"]);
    expect(ids(applyMoves("a", list, [move("3", "a", 0)]))).toEqual(["3", "1", "2"]);
  });

  it("retire la ligne du couloir de départ et la pose dans celui d'arrivée", () => {
    const pending = [move("2", "b", 1)];
    expect(ids(applyMoves("a", [row("1"), row("2")], pending))).toEqual(["1"]);
    const arrived = applyMoves("b", [row("x", "b"), row("y", "b")], pending);
    expect(ids(arrived)).toEqual(["x", "2", "y"]);
    expect(arrived[1]!.lane_id).toBe("b");
  });

  it("borne un rang hors liste et enchaîne les déplacements", () => {
    const list = [row("1"), row("2"), row("3")];
    expect(ids(applyMoves("a", list, [move("1", "a", 99)]))).toEqual(["2", "3", "1"]);
    expect(ids(applyMoves("a", list, [move("1", "a", 2), move("3", "a", 0)]))).toEqual(["3", "2", "1"]);
  });
});
