import { describe, expect, it } from "vitest";

import { belongsToFeed, buildFeed, feedSummary, isVideoPath, monthEnd } from "./feed";
import type { MonthWithLanes, SubjectRow } from "./types";

const subject = (partial: Partial<SubjectRow>): SubjectRow =>
  ({
    id: partial.id ?? "s",
    name: partial.name ?? "Sujet",
    status: partial.status ?? "validated",
    format: partial.format ?? "post",
    scheduled_on: partial.scheduled_on ?? null,
    position: partial.position ?? 0,
    visuals: partial.visuals ?? [],
    ...partial,
  }) as SubjectRow;

const month = (
  key: string,
  lanes: { platform: string; subjects: SubjectRow[] }[],
): MonthWithLanes =>
  ({
    id: `m-${key}`,
    month: key,
    label: key,
    lanes: lanes.map((lane, index) => ({
      id: `l-${key}-${index}`,
      platform: lane.platform,
      subjects: lane.subjects,
    })),
  }) as unknown as MonthWithLanes;

const visual = (name: string) => ({ path: name, url: `https://x/${name}`, name });

describe("belongsToFeed", () => {
  it("écarte les stories : elles ne se rangent pas dans la grille", () => {
    expect(belongsToFeed(subject({ format: "story" }))).toBe(false);
    expect(belongsToFeed(subject({ format: "reel" }))).toBe(true);
    expect(belongsToFeed(subject({ format: "carousel" }))).toBe(true);
  });

  it("écarte un contenu non retenu", () => {
    expect(belongsToFeed(subject({ status: "dropped" }))).toBe(false);
  });
});

describe("isVideoPath", () => {
  it("reconnaît les vidéos, pas les images", () => {
    expect(isVideoPath("a/b/reel.mp4")).toBe(true);
    expect(isVideoPath("a/b/creation.MOV")).toBe(true);
    expect(isVideoPath("a/b/visuel.jpg")).toBe(false);
  });
});

describe("monthEnd", () => {
  it("rend le dernier jour du mois, années bissextiles comprises", () => {
    expect(monthEnd("2026-09-01")).toBe("2026-09-30");
    expect(monthEnd("2026-02-01")).toBe("2026-02-28");
    expect(monthEnd("2028-02-01")).toBe("2028-02-29");
  });
});

describe("buildFeed", () => {
  const months = [
    month("2026-08-01", [
      {
        platform: "meta",
        subjects: [
          subject({ id: "a", scheduled_on: "2026-08-03", visuals: [visual("a.jpg")] }),
          subject({ id: "b", scheduled_on: "2026-08-19", visuals: [visual("b.mp4")] }),
          subject({ id: "story", scheduled_on: "2026-08-20", format: "story" }),
        ],
      },
    ]),
    month("2026-09-01", [
      {
        platform: "meta",
        subjects: [
          subject({
            id: "c",
            scheduled_on: "2026-09-09",
            format: "carousel",
            visuals: [visual("c1.jpg"), visual("c2.jpg")],
          }),
          subject({ id: "sans-crea", scheduled_on: "2026-09-21" }),
        ],
      },
    ]),
    month("2026-10-01", [
      {
        platform: "meta",
        subjects: [subject({ id: "octobre", scheduled_on: "2026-10-02" })],
      },
    ]),
  ];

  it("range du plus récent au plus ancien, mois précédents compris", () => {
    const tiles = buildFeed(months, "2026-09-01");
    expect(tiles.map((tile) => tile.subject.id)).toEqual([
      "sans-crea",
      "c",
      "b",
      "a",
    ]);
  });

  it("s'arrête à la fin du mois choisi", () => {
    expect(
      buildFeed(months, "2026-08-01").map((tile) => tile.subject.id),
    ).toEqual(["b", "a"]);
  });

  it("met en avant la première image d'un carrousel", () => {
    const tiles = buildFeed(months, "2026-09-01");
    expect(tiles.find((tile) => tile.subject.id === "c")?.cover?.name).toBe("c1.jpg");
  });

  it("signale une vidéo, qui s'affiche par sa première image", () => {
    const tiles = buildFeed(months, "2026-09-01");
    expect(tiles.find((tile) => tile.subject.id === "b")?.isVideo).toBe(true);
    expect(tiles.find((tile) => tile.subject.id === "a")?.isVideo).toBe(false);
  });

  it("garde la case d'un sujet sans créa — c'est le trou qu'on vient voir", () => {
    const tiles = buildFeed(months, "2026-09-01");
    expect(tiles.find((tile) => tile.subject.id === "sans-crea")?.cover).toBeNull();
    expect(feedSummary(tiles)).toEqual({ total: 4, missing: 1 });
  });

  it("départage deux publications du même jour par l'ordre du tableau, inversé", () => {
    const sameDay = [
      month("2026-08-01", [
        {
          platform: "meta",
          subjects: [
            subject({ id: "premier", scheduled_on: "2026-08-10", position: 0 }),
            subject({ id: "second", scheduled_on: "2026-08-10", position: 1 }),
          ],
        },
      ]),
    ];
    expect(buildFeed(sameDay, "2026-08-01").map((tile) => tile.subject.id)).toEqual([
      "second",
      "premier",
    ]);
  });
});
