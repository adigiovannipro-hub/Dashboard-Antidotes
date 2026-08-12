import { describe, expect, it } from "vitest";

import {
  defaultDueWindow,
  evaluateCycle,
  monthLabel,
  shiftMonth,
  targetMonthFor,
  type PhaseCycleInput,
  type PhaseSlice,
} from "./phases";

/** Une ligne de phase minimale ; chaque test ne précise que ce qui compte. */
const slice = (overrides: Partial<PhaseSlice> = {}): PhaseSlice => ({
  phase: "intentions",
  target_month: "2026-09-01",
  status: "pending",
  completed_at: null,
  due_start: null,
  due_end: null,
  ...overrides,
});

const cycle = (overrides: Partial<PhaseCycleInput> = {}) =>
  evaluateCycle({
    today: "2026-08-11",
    rows: [],
    firstPublicationOfTarget: null,
    ...overrides,
  });

const segment = (view: ReturnType<typeof evaluateCycle>, phase: string) =>
  view.segments.find((entry) => entry.phase === phase)!;

describe("shiftMonth", () => {
  it("avance et recule d'un mois", () => {
    expect(shiftMonth("2026-08", 1)).toBe("2026-09");
    expect(shiftMonth("2026-08", -1)).toBe("2026-07");
  });

  it("franchit les changements d'année dans les deux sens", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});

describe("targetMonthFor", () => {
  it("fait viser le mois suivant aux intentions, au wording et à la programmation", () => {
    expect(targetMonthFor("intentions", "2026-08-11")).toBe("2026-09-01");
    expect(targetMonthFor("wording", "2026-08-11")).toBe("2026-09-01");
    expect(targetMonthFor("programmation", "2026-08-11")).toBe("2026-09-01");
  });

  it("fait viser le mois précédent au reporting", () => {
    expect(targetMonthFor("reporting", "2026-08-11")).toBe("2026-07-01");
  });
});

describe("monthLabel", () => {
  it("rend le mois français capitalisé", () => {
    expect(monthLabel("2026-08")).toBe("Août");
    expect(monthLabel("2026-02")).toBe("Février");
  });
});

describe("defaultDueWindow", () => {
  it("cale le reporting du 1er au 5 et les intentions du 10 au 20", () => {
    const context = { intentionsCompletedOn: null, firstPublicationOfTarget: null };
    expect(defaultDueWindow("reporting", "2026-08-11", context)).toEqual({
      start: "2026-08-01",
      end: "2026-08-05",
    });
    expect(defaultDueWindow("intentions", "2026-08-11", context)).toEqual({
      start: "2026-08-10",
      end: "2026-08-20",
    });
  });

  it("donne 5 jours au wording après la fin des intentions, sinon rien", () => {
    expect(
      defaultDueWindow("wording", "2026-08-11", {
        intentionsCompletedOn: "2026-08-18",
        firstPublicationOfTarget: null,
      }),
    ).toEqual({ start: "2026-08-18", end: "2026-08-23" });

    expect(
      defaultDueWindow("wording", "2026-08-11", {
        intentionsCompletedOn: null,
        firstPublicationOfTarget: null,
      }),
    ).toBeNull();
  });

  it("boucle la programmation trois jours avant la première publication", () => {
    expect(
      defaultDueWindow("programmation", "2026-08-25", {
        intentionsCompletedOn: null,
        firstPublicationOfTarget: "2026-09-01",
      }),
    ).toEqual({ start: "2026-08-25", end: "2026-08-29" });

    expect(
      defaultDueWindow("programmation", "2026-08-25", {
        intentionsCompletedOn: null,
        firstPublicationOfTarget: null,
      }),
    ).toBeNull();
  });
});

describe("evaluateCycle", () => {
  it("ouvre le mois sur le reporting du mois précédent, dans sa fenêtre", () => {
    const view = cycle({ today: "2026-08-03" });
    expect(view.currentPhase).toBe("reporting");
    expect(view.subtitle).toBe("Août · Reporting");
    expect(segment(view, "reporting").tone).toBe("urgent");
    expect(segment(view, "reporting").targetMonth).toBe("2026-07-01");
    // Les intentions n'ouvrent que le 10 : pas encore urgentes.
    expect(segment(view, "intentions").tone).toBe("idle");
    expect(view.lateBadge).toBeNull();
  });

  it("marque le reporting en retard passé le 5, sans lâcher la main avant le 15", () => {
    const view = cycle({ today: "2026-08-12" });
    expect(view.currentPhase).toBe("reporting");
    expect(segment(view, "reporting").late).toBe(true);
    expect(view.lateBadge).toBe("Reporting en retard");
  });

  it("passe la main aux intentions le 15 même si le reporting n'est pas fait", () => {
    const view = cycle({ today: "2026-08-16" });
    expect(view.currentPhase).toBe("intentions");
    expect(view.subtitle).toBe("Août · Intentions");
    // Le reporting reste affiché en retard : passé, pas blanchi.
    expect(segment(view, "reporting").late).toBe(true);
    expect(view.lateBadge).toBe("Reporting en retard");
  });

  it("enchaîne sur les intentions dès que le reporting est généré", () => {
    const view = cycle({
      today: "2026-08-04",
      rows: [
        slice({
          phase: "reporting",
          target_month: "2026-07-01",
          status: "done",
          completed_at: "2026-08-04T09:00:00Z",
        }),
      ],
    });
    expect(view.currentPhase).toBe("intentions");
    expect(segment(view, "reporting").tone).toBe("ok");
  });

  it("ouvre la fenêtre du wording à la fin des intentions, puis le met en retard", () => {
    const rows = [
      slice({
        phase: "reporting",
        target_month: "2026-07-01",
        status: "done",
        completed_at: "2026-08-03T09:00:00Z",
      }),
      slice({
        phase: "intentions",
        status: "done",
        completed_at: "2026-08-18T17:00:00Z",
      }),
    ];

    const during = cycle({ today: "2026-08-20", rows });
    expect(during.currentPhase).toBe("wording");
    expect(during.subtitle).toBe("Août · Content");
    expect(segment(during, "wording").tone).toBe("urgent");
    expect(during.lateBadge).toBeNull();

    const after = cycle({ today: "2026-08-24", rows });
    expect(segment(after, "wording").late).toBe(true);
    expect(after.lateBadge).toBe("Content en retard");
  });

  it("laisse la programmation grise sans date de publication, l'allume avec", () => {
    const rows = [
      slice({
        phase: "reporting",
        target_month: "2026-07-01",
        status: "done",
        completed_at: "2026-08-03T09:00:00Z",
      }),
      slice({ phase: "intentions", status: "done", completed_at: "2026-08-15T09:00:00Z" }),
      slice({ phase: "wording", status: "done", completed_at: "2026-08-19T09:00:00Z" }),
    ];

    const without = cycle({ today: "2026-08-26", rows });
    expect(without.currentPhase).toBe("programmation");
    expect(segment(without, "programmation").tone).toBe("idle");

    const withDate = cycle({
      today: "2026-08-26",
      rows,
      firstPublicationOfTarget: "2026-09-01",
    });
    expect(segment(withDate, "programmation").tone).toBe("urgent");
  });

  it("garde le vert sur une phase en cours, sauf fenêtre dépassée", () => {
    const inWindow = cycle({
      today: "2026-08-12",
      rows: [
        slice({
          phase: "reporting",
          target_month: "2026-07-01",
          status: "done",
          completed_at: "2026-08-03T09:00:00Z",
        }),
        slice({ phase: "intentions", status: "in_progress" }),
      ],
    });
    expect(segment(inWindow, "intentions").tone).toBe("ok");

    const overdue = cycle({
      today: "2026-08-22",
      rows: [
        slice({
          phase: "reporting",
          target_month: "2026-07-01",
          status: "done",
          completed_at: "2026-08-03T09:00:00Z",
        }),
        slice({ phase: "intentions", status: "in_progress" }),
      ],
    });
    expect(segment(overdue, "intentions").tone).toBe("urgent");
    expect(overdue.lateBadge).toBe("Intentions en retard");
  });

  it("revient au reporting si toute la chaîne est bouclée mais pas lui", () => {
    const view = cycle({
      today: "2026-08-28",
      rows: [
        slice({ phase: "intentions", status: "done", completed_at: "2026-08-16T09:00:00Z" }),
        slice({ phase: "wording", status: "done", completed_at: "2026-08-20T09:00:00Z" }),
        slice({ phase: "programmation", status: "done", completed_at: "2026-08-26T09:00:00Z" }),
      ],
    });
    expect(view.currentPhase).toBe("reporting");
    expect(view.lateBadge).toBe("Reporting en retard");
  });

  it("déclare le cycle bouclé quand les quatre phases sont réglées", () => {
    const view = cycle({
      today: "2026-08-28",
      rows: [
        slice({
          phase: "reporting",
          target_month: "2026-07-01",
          status: "done",
          completed_at: "2026-08-04T09:00:00Z",
        }),
        slice({ phase: "intentions", status: "done", completed_at: "2026-08-16T09:00:00Z" }),
        slice({ phase: "wording", status: "skipped" }),
        slice({ phase: "programmation", status: "done", completed_at: "2026-08-26T09:00:00Z" }),
      ],
    });
    expect(view.currentPhase).toBeNull();
    expect(view.subtitle).toBe("Août · Cycle bouclé");
    expect(view.segments.every((entry) => entry.tone === "ok")).toBe(true);
    expect(view.lateBadge).toBeNull();
  });

  it("respecte une fenêtre dérogée portée par la ligne", () => {
    const view = cycle({
      today: "2026-08-12",
      rows: [
        slice({
          phase: "reporting",
          target_month: "2026-07-01",
          // Ce client rend son reporting le 12 : pas de retard au 12.
          due_start: "2026-08-08",
          due_end: "2026-08-12",
        }),
      ],
    });
    expect(segment(view, "reporting").late).toBe(false);
    expect(segment(view, "reporting").tone).toBe("urgent");
    expect(view.lateBadge).toBeNull();
  });

  it("ignore les lignes d'un autre mois cible", () => {
    const view = cycle({
      today: "2026-08-11",
      rows: [
        // Le cycle de juillet, bouclé : il ne doit pas colorer août.
        slice({ phase: "intentions", target_month: "2026-08-01", status: "done" }),
      ],
    });
    expect(segment(view, "intentions").status).toBe("pending");
  });
});
