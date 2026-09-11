import { describe, expect, it } from "vitest";

import { sortForSegment, type SortableConversation } from "./sorting";

const NOW = new Date("2026-09-11T12:00:00Z");

const hoursAgo = (hours: number) =>
  new Date(NOW.getTime() - hours * 3_600_000).toISOString();

const dm = (hours: number, id: string): SortableConversation & { id: string } => ({
  id,
  channel: "instagram",
  kind: "dm",
  last_message_at: hoursAgo(hours),
});

const commentaire = (
  hours: number,
  id: string,
): SortableConversation & { id: string } => ({
  id,
  channel: "facebook",
  kind: "comment",
  last_message_at: hoursAgo(hours),
});

describe("sortForSegment", () => {
  it("range du plus récent au plus ancien hors « À traiter »", () => {
    const rows = [dm(48, "vieux"), dm(1, "recent"), commentaire(10, "milieu")];
    expect(sortForSegment(rows, "traitees", NOW).map((row) => row.id)).toEqual([
      "recent",
      "milieu",
      "vieux",
    ]);
  });

  it("fait remonter un message privé dont la fenêtre ferme aujourd'hui", () => {
    // 150 h écoulées sur les 168 de la fenêtre : il reste 18 h.
    const rows = [dm(1, "frais"), commentaire(2, "commentaire"), dm(150, "urgent")];
    expect(sortForSegment(rows, "a-traiter", NOW).map((row) => row.id)).toEqual([
      "urgent",
      "frais",
      "commentaire",
    ]);
  });

  it("met le plus pressé en tête parmi les urgents", () => {
    const rows = [dm(150, "moins-presse"), dm(166, "presse")];
    expect(sortForSegment(rows, "a-traiter", NOW).map((row) => row.id)).toEqual([
      "presse",
      "moins-presse",
    ]);
  });

  it("ne fait pas remonter un commentaire, qui n'a pas de fenêtre", () => {
    const rows = [commentaire(4000, "ancien"), dm(1, "recent")];
    expect(sortForSegment(rows, "a-traiter", NOW).map((row) => row.id)).toEqual([
      "recent",
      "ancien",
    ]);
  });

  it("ne fait pas remonter un fil déjà expiré : rien ne peut plus y partir", () => {
    const rows = [dm(200, "expire"), dm(1, "recent")];
    expect(sortForSegment(rows, "a-traiter", NOW).map((row) => row.id)).toEqual([
      "recent",
      "expire",
    ]);
  });

  it("ne modifie pas le tableau reçu", () => {
    const rows = [dm(1, "a"), dm(150, "b")];
    sortForSegment(rows, "a-traiter", NOW);
    expect(rows.map((row) => row.id)).toEqual(["a", "b"]);
  });
});
