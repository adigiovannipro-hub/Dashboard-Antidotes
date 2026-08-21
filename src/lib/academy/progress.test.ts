import { describe, expect, it } from "vitest";

import {
  completionOf,
  progressByLesson,
  resumeLesson,
  shouldComplete,
  type ProgressLite,
} from "./progress";

const row = (overrides: Partial<ProgressLite> & { lesson_id: string }): ProgressLite => ({
  status: "in_progress",
  watched_seconds: 0,
  updated_at: "2026-08-01T10:00:00.000Z",
  ...overrides,
});

const lessons = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];

describe("completionOf", () => {
  it("compte les terminées et arrondit le pourcentage", () => {
    const progress = progressByLesson([
      row({ lesson_id: "a", status: "completed" }),
      row({ lesson_id: "b", status: "in_progress" }),
    ]);
    expect(completionOf(lessons, progress)).toEqual({
      completed: 1,
      total: 4,
      percent: 25,
    });
  });

  it("rend 0 % sans leçon plutôt qu'une division par zéro", () => {
    expect(completionOf([], new Map())).toEqual({ completed: 0, total: 0, percent: 0 });
  });
});

describe("resumeLesson", () => {
  it("rouvre la dernière leçon encore en cours, pas la première", () => {
    const progress = progressByLesson([
      row({ lesson_id: "a", updated_at: "2026-08-01T10:00:00.000Z" }),
      row({ lesson_id: "c", updated_at: "2026-08-02T10:00:00.000Z" }),
    ]);
    expect(resumeLesson(lessons, progress)?.id).toBe("c");
  });

  it("sans leçon en cours, propose la première jamais terminée", () => {
    const progress = progressByLesson([
      row({ lesson_id: "a", status: "completed" }),
      row({ lesson_id: "b", status: "completed" }),
    ]);
    expect(resumeLesson(lessons, progress)?.id).toBe("c");
  });

  it("rend null quand tout est terminé", () => {
    const progress = progressByLesson(
      lessons.map((lesson) => row({ lesson_id: lesson.id, status: "completed" })),
    );
    expect(resumeLesson(lessons, progress)).toBeNull();
  });
});

describe("shouldComplete", () => {
  it("valide à 90 % de la durée, pas avant", () => {
    expect(shouldComplete(539, 600)).toBe(false);
    expect(shouldComplete(540, 600)).toBe(true);
  });

  it("ne devine jamais sans durée connue", () => {
    expect(shouldComplete(10_000, null)).toBe(false);
    expect(shouldComplete(10_000, 0)).toBe(false);
  });
});
