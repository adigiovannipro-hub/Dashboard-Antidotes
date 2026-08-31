import { describe, expect, it } from "vitest";

import type { ColumnDef } from "./columns";
import { sortSubjects, sortableKey } from "./sort";
import type { SubjectRow } from "./types";

const subject = (partial: Partial<SubjectRow>): SubjectRow =>
  ({
    id: partial.id ?? "s",
    name: partial.name ?? "Sujet",
    status: partial.status ?? "idea",
    format: partial.format ?? "other",
    scheduled_on: partial.scheduled_on ?? null,
    ad_objective: partial.ad_objective ?? null,
    ad_status: partial.ad_status ?? null,
    position: partial.position ?? 0,
    ...partial,
  }) as SubjectRow;

const column = (partial: Partial<ColumnDef>): ColumnDef =>
  ({
    id: partial.id ?? "format",
    builtin: partial.builtin ?? "format",
    labels: partial.labels ?? null,
    ...partial,
  }) as ColumnDef;

const formatColumn = column({
  builtin: "format",
  labels: [
    { id: "post", label: "POST", color: "#784bd1" },
    { id: "reel", label: "REELS", color: "#9d50dd" },
    { id: "carousel", label: "CARROUSEL", color: "#66ccff" },
  ],
});

const ids = (rows: SubjectRow[]) => rows.map((row) => row.id);

describe("sortableKey", () => {
  it("trie la date et les colonnes à étiquettes, rien d'autre", () => {
    expect(sortableKey(column({ builtin: "date" }))).toBe("date");
    expect(sortableKey(column({ builtin: "status" }))).toBe("status");
    expect(sortableKey(column({ builtin: "ad_status" }))).toBe("ad_status");
    expect(sortableKey(column({ builtin: "name" }))).toBeNull();
    expect(sortableKey(column({ builtin: null }))).toBeNull();
  });
});

describe("sortSubjects", () => {
  const rows = [
    subject({ id: "a", scheduled_on: "2026-09-18", format: "carousel", position: 0 }),
    subject({ id: "b", scheduled_on: null, format: "reel", position: 1 }),
    subject({ id: "c", scheduled_on: "2026-09-02", format: "post", position: 2 }),
    subject({ id: "d", scheduled_on: "2026-09-02", format: "other", position: 3 }),
  ];

  it("rend l'ordre manuel tel quel", () => {
    expect(sortSubjects(rows, "position", [formatColumn])).toBe(rows);
  });

  it("range les dates en chronologie, les sans-date en fin, l'ordre manuel en départage", () => {
    const sorted = sortSubjects(
      rows,
      { column: "date", direction: "asc" },
      [formatColumn],
    );
    expect(ids(sorted)).toEqual(["c", "d", "a", "b"]);
  });

  it("inverse la chronologie sans remonter les sans-date", () => {
    const sorted = sortSubjects(
      rows,
      { column: "date", direction: "desc" },
      [formatColumn],
    );
    expect(ids(sorted)).toEqual(["a", "c", "d", "b"]);
  });

  it("trie une colonne à étiquettes dans l'ordre déclaré des étiquettes, pas l'alphabet", () => {
    const sorted = sortSubjects(
      rows,
      { column: "format", direction: "asc" },
      [formatColumn],
    );
    // POST puis REELS puis CARROUSEL — l'alphabet aurait mis CARROUSEL en tête.
    expect(ids(sorted)).toEqual(["c", "b", "a", "d"]);
  });

  it("descend les « rien de choisi » (other, idea) avec les vides, dans les deux sens", () => {
    const asc = sortSubjects(rows, { column: "format", direction: "asc" }, [formatColumn]);
    const desc = sortSubjects(rows, { column: "format", direction: "desc" }, [formatColumn]);
    expect(ids(asc).at(-1)).toBe("d");
    expect(ids(desc).at(-1)).toBe("d");
    expect(ids(desc).slice(0, 3)).toEqual(["a", "b", "c"]);
  });

  it("ne touche jamais le tableau d'entrée", () => {
    const before = ids(rows);
    sortSubjects(rows, { column: "date", direction: "desc" }, [formatColumn]);
    expect(ids(rows)).toEqual(before);
  });
});
