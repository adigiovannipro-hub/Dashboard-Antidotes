import { describe, expect, it } from "vitest";

import {
  DAILY_TASK_TITLE,
  isDailyTask,
  withoutDailyTasks,
  type WorkTask,
} from "./types";

let counter = 0;

const task = (overrides: Partial<WorkTask> = {}): WorkTask => {
  counter += 1;
  return {
    id: `task-${counter}`,
    org_id: "org",
    workspace_id: null,
    cycle_step_id: null,
    title: `Tâche ${counter}`,
    source: "manual",
    status: "pending",
    due_date: "2026-08-05",
    done_at: null,
    dedupe_key: null,
    source_url: null,
    source_label: null,
    created_at: "2026-08-01T10:00:00Z",
    updated_at: "2026-08-01T10:00:00Z",
    ...overrides,
  };
};

/** Une occurrence de l'ancienne ligne quotidienne, telle que la base en porte. */
const daily = (overrides: Partial<WorkTask> = {}): WorkTask =>
  task({
    title: DAILY_TASK_TITLE,
    source: "recurring",
    cycle_step_id: null,
    dedupe_key: "daily:2026-08-05",
    ...overrides,
  });

describe("isDailyTask", () => {
  it("reconnaît une récurrence sans étape de cycle", () => {
    expect(isDailyTask(daily())).toBe(true);
  });

  it("laisse passer une occurrence de cycle, qui porte son étape", () => {
    expect(
      isDailyTask(task({ source: "recurring", cycle_step_id: "step-1" })),
    ).toBe(false);
  });

  it("laisse passer une tâche manuelle, même sans étape", () => {
    expect(isDailyTask(task())).toBe(false);
  });

  it("reconnaît une occurrence renommée à la main : le titre ne juge pas", () => {
    expect(isDailyTask(daily({ title: "Routine du matin" }))).toBe(true);
  });
});

describe("withoutDailyTasks", () => {
  it("écarte les lignes quotidiennes et garde le reste dans l'ordre", () => {
    const manual = task();
    const cycleStep = task({ source: "recurring", cycle_step_id: "step-1" });
    const kept = withoutDailyTasks([daily(), manual, daily(), cycleStep]);

    expect(kept.map((entry) => entry.id)).toEqual([manual.id, cycleStep.id]);
  });

  it("écarte une occurrence cochée aussi bien qu'une occurrence ouverte", () => {
    const done = daily({ status: "done", done_at: "2026-08-04T16:45:00Z" });
    expect(withoutDailyTasks([done])).toEqual([]);
  });

  it("rend une liste vide inchangée", () => {
    expect(withoutDailyTasks([])).toEqual([]);
  });
});
