import { describe, expect, it } from "vitest";

import { dueDrafts, type DueDraft } from "./due-drafts";

const NOW = new Date("2026-09-10T09:00:00Z");
const draft = (over: Partial<DueDraft> & { id: string }): DueDraft => ({
  format: "linkedin_post",
  status: "approved",
  scheduled_at: "2026-09-10T08:00:00Z",
  content: "Texte.",
  ...over,
});

describe("dueDrafts", () => {
  it("ne rend que les posts LinkedIn approuvés dont l'heure est passée", () => {
    const drafts = [
      draft({ id: "dû" }),
      draft({ id: "pas-encore", scheduled_at: "2026-09-11T08:00:00Z" }),
      draft({ id: "sans-date", scheduled_at: null }),
      draft({ id: "brouillon", status: "draft" }),
      draft({ id: "déjà-publié", status: "published" }),
      draft({ id: "écarté", status: "rejected" }),
      draft({ id: "script", format: "reel_script" }),
    ];
    expect(dueDrafts(drafts, NOW).map((entry) => entry.id)).toEqual(["dû"]);
  });

  it("part du plus ancien : un retard se rattrape dans l'ordre", () => {
    const drafts = [
      draft({ id: "hier", scheduled_at: "2026-09-09T08:00:00Z" }),
      draft({ id: "ce matin", scheduled_at: "2026-09-10T07:00:00Z" }),
    ];
    expect(dueDrafts(drafts, NOW).map((entry) => entry.id)).toEqual(["hier", "ce matin"]);
  });
});
