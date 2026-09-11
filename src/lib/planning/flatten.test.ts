import { describe, expect, it } from "vitest";

import type { PlanningView } from "@/lib/ui-preferences";
import type { ColumnDef } from "./columns";
import { rangeBetween, visibleSubjectIds, type VisibleSubjectsOptions } from "./flatten";
import type { LaneWithSubjects, MonthWithLanes, SubjectRow } from "./types";

const subject = (id: string, partial: Partial<SubjectRow> = {}): SubjectRow =>
  ({
    id,
    name: id,
    position: 0,
    scheduled_on: null,
    status: "validated",
    ...partial,
  }) as unknown as SubjectRow;

const lane = (id: string, subjects: SubjectRow[]): LaneWithSubjects =>
  ({ id, subjects }) as unknown as LaneWithSubjects;

const month = (key: string, lanes: LaneWithSubjects[]): MonthWithLanes =>
  ({ id: key, month: `${key}-01`, label: key, lanes }) as unknown as MonthWithLanes;

const view = (partial: Partial<PlanningView> = {}): PlanningView => ({
  sort: "position",
  mode: "tableau",
  months: null,
  closedLanes: [],
  ...partial,
});

const options = (partial: Partial<VisibleSubjectsOptions> = {}): VisibleSubjectsOptions => ({
  months: [],
  columns: [] as ColumnDef[],
  view: view(),
  currentMonthKey: "2026-08-01",
  searching: false,
  calendar: false,
  ...partial,
});

/** Août et septembre, deux couloirs chacun, dans l'ordre du tableau. */
const deuxMois = [
  month("2026-08", [
    lane("l-insta", [subject("a1"), subject("a2")]),
    lane("l-face", [subject("a3")]),
  ]),
  month("2026-09", [lane("l-sept", [subject("s1"), subject("s2")])]),
];

describe("visibleSubjectIds", () => {
  it("suit l'ordre de l'écran : mois, puis couloirs, puis lignes", () => {
    const ids = visibleSubjectIds(
      options({ months: deuxMois, view: view({ months: ["2026-08", "2026-09"] }) }),
    );
    expect(ids).toEqual(["a1", "a2", "a3", "s1", "s2"]);
  });

  it("saute un mois replié", () => {
    const ids = visibleSubjectIds(
      options({ months: deuxMois, view: view({ months: ["2026-09"] }) }),
    );
    expect(ids).toEqual(["s1", "s2"]);
  });

  it("n'ouvre que le mois en cours tant que le cookie n'a jamais été touché", () => {
    const ids = visibleSubjectIds(
      options({ months: deuxMois, view: view({ months: null }) }),
    );
    expect(ids).toEqual(["a1", "a2", "a3"]);
  });

  it("replie tout quand la liste des mois est vide — ce n'est pas « jamais touché »", () => {
    const ids = visibleSubjectIds(
      options({ months: deuxMois, view: view({ months: [] }) }),
    );
    expect(ids).toEqual([]);
  });

  it("saute un couloir replié, même en recherche : forceOpen s'arrête aux mois", () => {
    const ids = visibleSubjectIds(
      options({
        months: deuxMois,
        view: view({ months: null, closedLanes: ["l-insta"] }),
        searching: true,
      }),
    );
    expect(ids).toEqual(["a3", "s1", "s2"]);
  });

  it("rejoue le tri du couloir : la tranche suit l'ordre affiché, pas l'ordre manuel", () => {
    const months = [
      month("2026-08", [
        lane("l-insta", [
          subject("tard", { position: 0, scheduled_on: "2026-08-20" }),
          subject("tot", { position: 1, scheduled_on: "2026-08-02" }),
        ]),
      ]),
    ];

    expect(visibleSubjectIds(options({ months }))).toEqual(["tard", "tot"]);
    expect(
      visibleSubjectIds(
        options({ months, view: view({ sort: { column: "date", direction: "asc" } }) }),
      ),
    ).toEqual(["tot", "tard"]);
  });

  it("rend une liste vide en mode calendrier : aucune case à cocher n'y est rendue", () => {
    const ids = visibleSubjectIds(
      options({
        months: deuxMois,
        view: view({ months: ["2026-08", "2026-09"], mode: "calendrier" }),
        calendar: true,
      }),
    );
    expect(ids).toEqual([]);
  });
});

describe("rangeBetween", () => {
  const ids = ["a1", "a2", "a3", "s1", "s2"];

  it("coche la plage à travers deux couloirs", () => {
    expect(rangeBetween(ids, "a2", "a3")).toEqual(["a2", "a3"]);
  });

  it("coche la plage à travers deux mois", () => {
    expect(rangeBetween(ids, "a1", "s1")).toEqual(["a1", "a2", "a3", "s1"]);
  });

  it("rend la même tranche quand la cible est au-dessus de l'ancre", () => {
    expect(rangeBetween(ids, "s2", "a2")).toEqual(["a2", "a3", "s1", "s2"]);
  });

  it("rend une tranche d'une ligne quand l'ancre est la cible", () => {
    expect(rangeBetween(ids, "a3", "a3")).toEqual(["a3"]);
  });

  it("ne devine rien quand l'ancre a disparu de l'écran", () => {
    expect(rangeBetween(ids, "replie", "s1")).toEqual([]);
    expect(rangeBetween(ids, "a1", "replie")).toEqual([]);
  });
});
