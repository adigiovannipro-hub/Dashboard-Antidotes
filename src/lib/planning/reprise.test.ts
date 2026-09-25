import { describe, expect, it } from "vitest";

import {
  parseMondayFiles,
  planReprise,
  wouldAutoPublish,
  type ExistingSubject,
  type RepriseSnapshot,
  type RepriseSubitem,
  type SubjectDraft,
} from "./reprise";

const COLUMNS = [
  { id: "person", title: "Propriétaire", type: "people" },
  { id: "status", title: "Status", type: "status" },
  { id: "dup__of_status", title: "Thématique", type: "status" },
  { id: "date0", title: "Date", type: "date" },
  { id: "fichier", title: "Visuel", type: "file" },
  { id: "texte5", title: "Wording", type: "long_text" },
  { id: "dup__of_wording", title: "Commentaires", type: "long_text" },
  { id: "cocher", title: "OK", type: "checkbox" },
  { id: "chiffres", title: "Sponsorisation", type: "numbers" },
  { id: "statut", title: "Objectifs", type: "status" },
  { id: "statut0", title: "Statut Ads", type: "status" },
];

const subitem = (overrides: Partial<RepriseSubitem> = {}): RepriseSubitem => ({
  id: "s1",
  name: "SOLAIRE AMBRÉE",
  url: null,
  updatedAt: null,
  columnValues: {
    status: "PUBLIÉ",
    dup__of_status: "POST",
    date0: "2026-04-20",
    texte5: "Une lumière d'ambre.\n\nÀ découvrir 🌞",
    fichier:
      "https://x.monday.com/protected_static/1/resources/217908953/Plan%20de%20travail%201.png",
  },
  updates: [],
  ...overrides,
});

const snapshot = (overrides: Partial<RepriseSnapshot> = {}): RepriseSnapshot => ({
  workspace: "bondet",
  year: 2026,
  excludedMonths: ["2026-10-01"],
  capturedAt: "2026-09-25T10:00:00Z",
  board: { id: "1", name: "LUNETTES BONDET I PE 2026", url: null },
  subitemBoardId: "2",
  subitemColumns: COLUMNS,
  groups: [
    { id: "g-avril", title: "AVRIL", position: 0 },
    { id: "g-aout", title: "AOUT", position: 1 },
    { id: "g-oct", title: "OCTOBRE", position: 2 },
    { id: "g-dark", title: "CAMPAGNE DARK ADS", position: 3 },
  ],
  items: [
    { id: "i-avril", name: "META", groupId: "g-avril", position: 0, subitems: [subitem()] },
  ],
  ...overrides,
});

const existing = (overrides: Partial<ExistingSubject> = {}): ExistingSubject => ({
  id: "x1",
  month_id: "m-avril",
  lane_id: "l-avril",
  external_id: null,
  name: "",
  wording: null,
  visual_urls: [],
  deleted_at: null,
  ...overrides,
});

const MONTHS = [
  { id: "m-avril", month: "2026-04-01", deleted_at: null },
  { id: "m-aout", month: "2026-08-01", deleted_at: "2026-09-01T00:00:00Z" },
  { id: "m-oct", month: "2026-10-01", deleted_at: null },
  { id: "m-jan", month: "2026-01-01", deleted_at: null },
];

describe("parseMondayFiles", () => {
  it("rend l'asset et le nom décodé de chaque fichier, dans l'ordre", () => {
    expect(
      parseMondayFiles(
        "https://x/protected_static/1/resources/11/Plan%20de%20travail%201.png, https://x/protected_static/1/resources/12/COVER%201.mp4",
      ),
    ).toEqual([
      { assetId: "11", name: "Plan de travail 1.png" },
      { assetId: "12", name: "COVER 1.mp4" },
    ]);
  });

  it("ne garde qu'une fois un asset posé deux fois sur la même ligne", () => {
    expect(
      parseMondayFiles(
        "https://x/resources/11/a.png, https://x/resources/12/b.png, https://x/resources/11/a.png",
      ).map((file) => file.assetId),
    ).toEqual(["11", "12"]);
  });

  it("rend une liste vide sans fichier", () => {
    expect(parseMondayFiles(null)).toEqual([]);
  });
});

describe("planReprise", () => {
  it("reprend nom, statut, format, date, wording à l'octet et fichiers", () => {
    const plan = planReprise({ snapshot: snapshot(), months: MONTHS, lanes: [], subjects: [] });

    expect(plan.subjects).toHaveLength(1);
    expect(plan.subjects[0]).toMatchObject({
      externalId: "s1",
      laneExternalId: "i-avril",
      month: "2026-04-01",
      name: "SOLAIRE AMBRÉE",
      status: "published",
      format: "post",
      scheduledOn: "2026-04-20",
      wording: "Une lumière d'ambre.\n\nÀ découvrir 🌞",
      files: [{ assetId: "217908953", name: "Plan de travail 1.png" }],
    });
  });

  it("ne touche jamais un mois exclu, même si Monday le décrit", () => {
    const plan = planReprise({
      snapshot: snapshot({
        items: [
          { id: "i-avril", name: "META", groupId: "g-avril", position: 0, subitems: [subitem()] },
          { id: "i-oct", name: "META", groupId: "g-oct", position: 1, subitems: [subitem({ id: "s-oct" })] },
        ],
      }),
      months: MONTHS,
      lanes: [{ id: "l-oct", month_id: "m-oct", external_id: null }],
      subjects: [existing({ id: "oct-1", month_id: "m-oct", lane_id: "l-oct", name: "EN PRÉPARATION" })],
    });

    expect(plan.subjects.map((s) => s.externalId)).toEqual(["s1"]);
    expect(plan.months.map((m) => m.month)).toEqual(["2026-04-01"]);
    expect(plan.deleteLaneIds).not.toContain("l-oct");
    expect(plan.trashSubjects).toEqual([]);
    expect(plan.deleteSubjectIds).toEqual([]);
  });

  it("ne touche pas un mois que Monday ne décrit pas", () => {
    const plan = planReprise({
      snapshot: snapshot(),
      months: MONTHS,
      lanes: [{ id: "l-jan", month_id: "m-jan", external_id: null }],
      subjects: [existing({ id: "jan-1", month_id: "m-jan", lane_id: "l-jan" })],
    });

    expect(plan.deleteLaneIds).toEqual([]);
    expect(plan.deleteSubjectIds).toEqual([]);
  });

  it("efface les essais vides et ce qui est déjà à la corbeille, met le contenu à la corbeille", () => {
    const plan = planReprise({
      snapshot: snapshot(),
      months: MONTHS,
      lanes: [{ id: "l-avril", month_id: "m-avril", external_id: null }],
      subjects: [
        existing({ id: "vide" }),
        existing({ id: "jete", name: "ddddd", deleted_at: "2026-08-20T00:00:00Z", visual_urls: ["ws/jete/a.png"] }),
        existing({ id: "vrai", name: "RENTRÉE OPTIQUE", wording: "On reconnaît…" }),
      ],
    });

    expect(plan.deleteSubjectIds.sort()).toEqual(["jete", "vide"]);
    expect(plan.orphanVisualPaths).toEqual(["ws/jete/a.png"]);
    expect(plan.trashSubjects).toEqual([{ id: "vrai", month: "2026-04-01" }]);
    expect(plan.deleteLaneIds).toEqual(["l-avril"]);
  });

  it("relève un mois repris qui était à la corbeille", () => {
    const plan = planReprise({
      snapshot: snapshot({
        items: [{ id: "i-aout", name: "META", groupId: "g-aout", position: 0, subitems: [subitem()] }],
      }),
      months: MONTHS,
      lanes: [],
      subjects: [],
    });

    expect(plan.months).toEqual([{ month: "2026-08-01", existingId: "m-aout", restore: true }]);
  });

  it("crée un mois absent du tableau", () => {
    const plan = planReprise({ snapshot: snapshot(), months: [], lanes: [], subjects: [] });
    expect(plan.months).toEqual([{ month: "2026-04-01", existingId: null, restore: false }]);
  });

  it("laisse une ligne déjà reprise à l'upsert, sans la ranger", () => {
    const plan = planReprise({
      snapshot: snapshot(),
      months: MONTHS,
      lanes: [{ id: "l-monday", month_id: "m-avril", external_id: "i-avril" }],
      subjects: [existing({ id: "deja", external_id: "s1", name: "SOLAIRE AMBRÉE" })],
    });

    expect(plan.deleteSubjectIds).toEqual([]);
    expect(plan.trashSubjects).toEqual([]);
    expect(plan.deleteLaneIds).toEqual([]);
  });

  it("signale un groupe qui n'est pas un mois sans l'importer", () => {
    const plan = planReprise({ snapshot: snapshot(), months: MONTHS, lanes: [], subjects: [] });
    expect(plan.skippedGroups).toEqual(["CAMPAGNE DARK ADS"]);
  });

  it("numérote les couloirs dans chaque mois", () => {
    const plan = planReprise({
      snapshot: snapshot({
        items: [
          { id: "a", name: "META", groupId: "g-avril", position: 0, subitems: [] },
          { id: "b", name: "TIKTOK", groupId: "g-avril", position: 1, subitems: [] },
          { id: "c", name: "META", groupId: "g-aout", position: 2, subitems: [] },
        ],
      }),
      months: MONTHS,
      lanes: [],
      subjects: [],
    });

    expect(plan.lanes.map((lane) => [lane.externalId, lane.platform, lane.position])).toEqual([
      ["a", "meta", 0],
      ["b", "tiktok", 1],
      ["c", "meta", 0],
    ]);
  });

  it("reprend sponsorisation, objectif, statut ads, commentaires et case OK", () => {
    const plan = planReprise({
      snapshot: snapshot({
        items: [
          {
            id: "i",
            name: "DARK",
            groupId: "g-avril",
            position: 0,
            subitems: [
              subitem({
                columnValues: {
                  status: "PUBLIÉ",
                  dup__of_status: "DARK",
                  chiffres: "806.8",
                  statut: "Vues vidéos",
                  statut0: "Fait",
                  dup__of_wording: "Relancer le client",
                  cocher: "v",
                  person: "Alessandro DI GIOVANNI",
                },
              }),
            ],
          },
        ],
      }),
      months: MONTHS,
      lanes: [],
      subjects: [],
    });

    expect(plan.subjects[0]).toMatchObject({
      format: "dark",
      sponsoring: 806.8,
      adObjective: "Vues vidéos",
      adStatus: "done",
      comments: "Relancer le client",
      ok: true,
      ownerName: "Alessandro DI GIOVANNI",
    });
    expect(plan.lanes[0]!.platform).toBe("other");
  });

  it("garde « En attente » tel quel et sans statut en idée", () => {
    const plan = planReprise({
      snapshot: snapshot({
        items: [
          {
            id: "i",
            name: "META",
            groupId: "g-avril",
            position: 0,
            subitems: [
              subitem({ id: "a", columnValues: { status: "EN ATTENTE" } }),
              subitem({ id: "b", columnValues: {} }),
            ],
          },
        ],
      }),
      months: MONTHS,
      lanes: [],
      subjects: [],
    });

    expect(plan.subjects.map((s) => s.status)).toEqual(["on_hold", "idea"]);
    expect(plan.warnings).toEqual([]);
  });

  it("signale un statut que le modèle ne connaît pas", () => {
    const plan = planReprise({
      snapshot: snapshot({
        items: [
          {
            id: "i",
            name: "META",
            groupId: "g-avril",
            position: 0,
            subitems: [subitem({ columnValues: { status: "ARCHIVÉ" } })],
          },
        ],
      }),
      months: MONTHS,
      lanes: [],
      subjects: [],
    });

    expect(plan.warnings).toEqual(["Statut inconnu « ARCHIVÉ » sur « SOLAIRE AMBRÉE »"]);
  });
});

describe("wouldAutoPublish", () => {
  const draft = (overrides: Partial<SubjectDraft> = {}): SubjectDraft => ({
    externalId: "s",
    laneExternalId: "l",
    month: "2026-09-01",
    name: "X",
    status: "validated",
    format: "post",
    scheduledOn: "2026-09-29",
    wording: null,
    sponsoring: null,
    adObjective: null,
    adStatus: null,
    position: 0,
    comments: null,
    ok: false,
    ownerName: null,
    files: [],
    ...overrides,
  });

  it("repère une publication validée datée d'aujourd'hui ou après", () => {
    expect(wouldAutoPublish(draft(), "2026-09-25")).toBe(true);
    expect(wouldAutoPublish(draft({ scheduledOn: "2026-09-25" }), "2026-09-25")).toBe(true);
  });

  it("ignore une story, une date passée et un autre statut", () => {
    expect(wouldAutoPublish(draft({ format: "story" }), "2026-09-25")).toBe(false);
    expect(wouldAutoPublish(draft({ scheduledOn: "2026-09-01" }), "2026-09-25")).toBe(false);
    expect(wouldAutoPublish(draft({ status: "scheduled" }), "2026-09-25")).toBe(false);
  });
});
