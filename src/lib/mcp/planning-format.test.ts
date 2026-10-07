import { describe, expect, it } from "vitest";

import { formatSubjectBlock } from "./planning-format";

const subject = (overrides: Partial<Parameters<typeof formatSubjectBlock>[0]> = {}) =>
  formatSubjectBlock({
    id: "6f1c2c3e-0000-4000-8000-000000000001",
    name: "Coulisses de l'atelier",
    statusLabel: "En cours",
    formatLabel: "Carrousel",
    scheduledOn: "2026-10-14",
    sponsoring: 150,
    visualCount: 0,
    commentCount: 2,
    blockers: "bloquée : visuel manquant",
    wording: "  Le brief  ",
    visualLines: [],
    ...overrides,
  });

describe("formatSubjectBlock", () => {
  it("rend exactement le bloc d'avant quand la publication n'a pas de visuel", () => {
    expect(subject()).toBe(
      [
        "### Coulisses de l'atelier",
        "id : 6f1c2c3e-0000-4000-8000-000000000001",
        "statut : En cours · type : Carrousel · date : 2026-10-14 · sponso : 150 €",
        "visuels : 0 · retours : 2 · bloquée : visuel manquant",
        "wording : Le brief",
      ].join("\n"),
    );
  });

  it("insère une ligne par visuel juste après le compteur, sans rien déplacer d'autre", () => {
    const block = subject({
      visualCount: 2,
      blockers: "prête à publier",
      visualLines: ["  - visuel 1 · image · https://s/1", "  - visuel 2 · vidéo · https://s/2"],
    });
    expect(block.split("\n")).toEqual([
      "### Coulisses de l'atelier",
      "id : 6f1c2c3e-0000-4000-8000-000000000001",
      "statut : En cours · type : Carrousel · date : 2026-10-14 · sponso : 150 €",
      "visuels : 2 · retours : 2 · prête à publier",
      "  - visuel 1 · image · https://s/1",
      "  - visuel 2 · vidéo · https://s/2",
      "wording : Le brief",
    ]);
  });

  it("garde ses replis : sans nom, sans date, sans sponsorisation, sans wording", () => {
    expect(subject({ name: "", scheduledOn: null, sponsoring: null, wording: null }).split("\n")).toEqual([
      "### (sans sujet)",
      "id : 6f1c2c3e-0000-4000-8000-000000000001",
      "statut : En cours · type : Carrousel · date : —",
      "visuels : 0 · retours : 2 · bloquée : visuel manquant",
      "wording : —",
    ]);
  });
});
