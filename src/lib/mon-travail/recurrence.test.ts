import { describe, expect, it } from "vitest";

import {
  dueDateForWeek,
  isOverdue,
  planCycleTasks,
  planDailyTask,
  type CycleForPlanning,
} from "./recurrence";
import { DAILY_TASK_TITLE } from "./types";

const ORG = "11111111-1111-4111-8111-111111111111";

const cycle = (overrides: Partial<CycleForPlanning> = {}): CycleForPlanning => ({
  workspace_id: "44444444-4444-4444-8444-444444444444",
  steps: [
    { id: "step-1", label: "Reporting et analyse", week_of_month: 1 },
    { id: "step-2", label: "Intentions de publication", week_of_month: 2 },
    { id: "step-5", label: "Monitoring et modération", week_of_month: null },
  ],
  ...overrides,
});

describe("planDailyTask", () => {
  it("produit la ligne quotidienne fixe, sans client, avec sa clé du jour", () => {
    const task = planDailyTask(ORG, "2026-08-05");
    expect(task.title).toBe(DAILY_TASK_TITLE);
    expect(task.workspace_id).toBeNull();
    expect(task.cycle_step_id).toBeNull();
    expect(task.due_date).toBe("2026-08-05");
    expect(task.dedupe_key).toBe("daily:2026-08-05");
  });

  it("donne la même clé à deux planifications du même jour", () => {
    expect(planDailyTask(ORG, "2026-08-05").dedupe_key).toBe(
      planDailyTask(ORG, "2026-08-05").dedupe_key,
    );
  });
});

describe("dueDateForWeek", () => {
  it("fait tomber la semaine N sur le jour 7 × N", () => {
    expect(dueDateForWeek("2026-08", 1)).toBe("2026-08-07");
    expect(dueDateForWeek("2026-08", 4)).toBe("2026-08-28");
  });

  it("borne la semaine 5 au dernier jour du mois", () => {
    expect(dueDateForWeek("2026-08", 5)).toBe("2026-08-31");
    expect(dueDateForWeek("2026-09", 5)).toBe("2026-09-30");
  });

  it("se replie sur le 28 pour un février sans semaine 5", () => {
    expect(dueDateForWeek("2027-02", 5)).toBe("2027-02-28");
  });

  it("connaît le 29 février des années bissextiles", () => {
    expect(dueDateForWeek("2028-02", 5)).toBe("2028-02-29");
  });
});

describe("planCycleTasks", () => {
  it("produit une occurrence par étape datée, quatre par étape hebdomadaire", () => {
    const planned = planCycleTasks({
      orgId: ORG,
      monthKey: "2026-08",
      cycles: [cycle()],
    });

    expect(planned).toHaveLength(2 + 4);
    expect(planned.filter((task) => task.cycle_step_id === "step-5")).toHaveLength(4);
  });

  it("date les occurrences hebdomadaires sur les quatre semaines du mois", () => {
    const planned = planCycleTasks({
      orgId: ORG,
      monthKey: "2026-08",
      cycles: [cycle({ steps: [{ id: "s", label: "Monitoring", week_of_month: null }] })],
    });

    expect(planned.map((task) => task.due_date)).toEqual([
      "2026-08-07",
      "2026-08-14",
      "2026-08-21",
      "2026-08-28",
    ]);
  });

  it("rattache chaque occurrence au client de son cycle", () => {
    const planned = planCycleTasks({
      orgId: ORG,
      monthKey: "2026-08",
      cycles: [cycle()],
    });

    expect(planned.every((task) => task.workspace_id === cycle().workspace_id)).toBe(
      true,
    );
  });

  it("rejoue le même plan à l'identique : les clés sont stables", () => {
    const input = { orgId: ORG, monthKey: "2026-08", cycles: [cycle()] };
    const first = planCycleTasks(input).map((task) => task.dedupe_key);
    const second = planCycleTasks(input).map((task) => task.dedupe_key);

    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(first.length);
  });

  it("sépare les clés de deux mois successifs", () => {
    const august = planCycleTasks({ orgId: ORG, monthKey: "2026-08", cycles: [cycle()] });
    const september = planCycleTasks({
      orgId: ORG,
      monthKey: "2026-09",
      cycles: [cycle()],
    });

    const overlap = august.filter((task) =>
      september.some((other) => other.dedupe_key === task.dedupe_key),
    );
    expect(overlap).toEqual([]);
  });
});

describe("isOverdue", () => {
  it("marque en retard une tâche en attente dont le jour est passé", () => {
    expect(isOverdue({ status: "pending", due_date: "2026-08-04" }, "2026-08-05")).toBe(
      true,
    );
  });

  it("laisse tranquille la tâche du jour même", () => {
    expect(isOverdue({ status: "pending", due_date: "2026-08-05" }, "2026-08-05")).toBe(
      false,
    );
  });

  it("ne compte jamais une tâche faite, même ancienne", () => {
    expect(isOverdue({ status: "done", due_date: "2026-07-01" }, "2026-08-05")).toBe(
      false,
    );
  });
});
