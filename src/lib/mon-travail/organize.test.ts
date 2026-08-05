import { describe, expect, it } from "vitest";

import { organizeTasks } from "./organize";
import type { WorkTask } from "./types";

const TODAY = "2026-08-05";

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
    due_date: TODAY,
    done_at: null,
    dedupe_key: null,
    source_url: null,
    source_label: null,
    created_at: `2026-08-01T10:00:${String(counter).padStart(2, "0")}Z`,
    updated_at: `2026-08-01T10:00:${String(counter).padStart(2, "0")}Z`,
    ...overrides,
  };
};

const daily = (day: string): WorkTask =>
  task({
    title: "Modération, publications, ads",
    source: "recurring",
    cycle_step_id: null,
    due_date: day,
    dedupe_key: `daily:${day}`,
  });

describe("organizeTasks", () => {
  it("remonte les retards à part, le plus ancien d'abord", () => {
    const late = task({ due_date: "2026-08-03" });
    const older = task({ due_date: "2026-08-01" });
    const { overdue } = organizeTasks([task(), late, older], TODAY);

    expect(overdue.map((entry) => entry.id)).toEqual([older.id, late.id]);
  });

  it("place la ligne quotidienne en tête d'aujourd'hui", () => {
    const manual = task();
    const routine = daily(TODAY);
    const { today } = organizeTasks([manual, routine], TODAY);

    expect(today[0]?.id).toBe(routine.id);
    expect(today[1]?.id).toBe(manual.id);
  });

  it("groupe les quatre jours suivants et ignore les jours vides", () => {
    const tomorrow = task({ due_date: "2026-08-06" });
    const inFour = task({ due_date: "2026-08-09" });
    const { upcoming } = organizeTasks([tomorrow, inFour], TODAY);

    expect(upcoming.map((group) => group.day)).toEqual(["2026-08-06", "2026-08-09"]);
    expect(upcoming[0]?.tasks.map((entry) => entry.id)).toEqual([tomorrow.id]);
  });

  it("ne montre rien au-delà du quatrième jour", () => {
    const beyond = task({ due_date: "2026-08-10" });
    const { overdue, today, upcoming } = organizeTasks([beyond], TODAY);

    expect(overdue).toEqual([]);
    expect(today).toEqual([]);
    expect(upcoming).toEqual([]);
  });

  it("écarte les tâches faites et supprimées de toutes les sections", () => {
    const done = task({ status: "done", done_at: "2026-08-05T09:00:00Z" });
    const deleted = task({ status: "deleted", due_date: "2026-08-01" });
    const { overdue, today, upcoming } = organizeTasks([done, deleted], TODAY);

    expect(overdue).toEqual([]);
    expect(today).toEqual([]);
    expect(upcoming).toEqual([]);
  });

  it("trie un jour par ordre de création à échéance égale", () => {
    const first = task({ due_date: "2026-08-06" });
    const second = task({ due_date: "2026-08-06" });
    const { upcoming } = organizeTasks([second, first], TODAY);

    expect(upcoming[0]?.tasks.map((entry) => entry.id)).toEqual([first.id, second.id]);
  });
});
