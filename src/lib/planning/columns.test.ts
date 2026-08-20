import { describe, expect, it } from "vitest";

import {
  builtinColumns,
  defaultLabelsFor,
  gridTemplate,
  resolveColumns,
  type ColumnOverride,
} from "./columns";

function override(partial: Partial<ColumnOverride>): ColumnOverride {
  return {
    id: partial.id ?? "override-1",
    board_id: "board-1",
    builtin_key: null,
    type: null,
    label: null,
    position: null,
    hidden: false,
    settings: {},
    width: null,
    ...partial,
  };
}

describe("colonnes de base", () => {
  it("rend le tableau complet sans aucun écart", () => {
    const columns = resolveColumns([]);
    expect(columns.map((column) => column.id)).toEqual([
      "name",
      "status",
      "format",
      "date",
      "visual",
      "wording",
      "sponsoring",
      "objective",
      "ad_status",
      "updated",
    ]);
  });

  it("porte les étiquettes du board d'origine", () => {
    const status = resolveColumns([]).find((column) => column.id === "status");
    expect(status?.labels?.find((label) => label.id === "published")).toEqual({
      id: "published",
      label: "PUBLIÉ",
      color: "#00c875",
    });
  });

  it("n'autorise la suppression que des colonnes ajoutées", () => {
    for (const column of builtinColumns()) {
      expect(column.removable).toBe(false);
    }
  });
});

describe("écarts sur une colonne de base", () => {
  it("renomme sans toucher au reste", () => {
    const columns = resolveColumns([
      override({ builtin_key: "sponsoring", label: "Budget" }),
    ]);
    const sponsoring = columns.find((column) => column.id === "sponsoring");
    expect(sponsoring?.label).toBe("Budget");
    expect(sponsoring?.type).toBe("number");
  });

  it("masque une colonne", () => {
    const columns = resolveColumns([
      override({ builtin_key: "objective", hidden: true }),
    ]);
    expect(columns.some((column) => column.id === "objective")).toBe(false);
  });

  it("déplace une colonne", () => {
    // Position 5 : entre Sujet (0) et Statut (10).
    const columns = resolveColumns([
      override({ builtin_key: "date", position: 5 }),
    ]);
    expect(columns.map((column) => column.id).slice(0, 3)).toEqual([
      "name",
      "date",
      "status",
    ]);
  });

  it("recolore une étiquette existante et accepte les nouvelles", () => {
    const columns = resolveColumns([
      override({
        builtin_key: "status",
        settings: {
          labels: [
            { id: "published", label: "EN LIGNE", color: "#000000" },
            // « + Nouvelle étiquette » : une valeur inventée s'ajoute à la
            // suite, depuis que la colonne est du texte (migration 0029).
            { id: "revision-client", label: "RÉVISION CLIENT", color: "#123456" },
          ],
        },
      }),
    ]);

    const labels = columns.find((column) => column.id === "status")?.labels ?? [];
    expect(labels.find((label) => label.id === "published")?.label).toBe("EN LIGNE");
    expect(labels.find((label) => label.id === "revision-client")?.label).toBe(
      "RÉVISION CLIENT",
    );
    // Les autres étiquettes restent intactes.
    expect(labels.find((label) => label.id === "draft")?.label).toBe("EN BROUILLON");
  });

  it("applique une largeur redimensionnée", () => {
    const columns = resolveColumns([
      override({ builtin_key: "wording", width: 340 }),
    ]);
    expect(columns.find((column) => column.id === "wording")?.width).toBe("340px");
  });

  it("colore les objectifs publicitaires du tableau", () => {
    const columns = resolveColumns([], {
      adObjectives: ["Engagement", "Notoriété locale"],
    });
    const labels = columns.find((column) => column.id === "objective")?.labels ?? [];
    expect(labels).toHaveLength(2);
    expect(labels[0]).toEqual({
      id: "Engagement",
      label: "Engagement",
      color: "#579bfc",
    });
    // Un objectif hors des sept connus reçoit une couleur de la palette.
    expect(labels[1]!.color).toMatch(/^#/);
  });
});

describe("colonnes ajoutées", () => {
  it("arrivent après les colonnes de base, avec leurs étiquettes propres", () => {
    const columns = resolveColumns([
      override({
        id: "custom-ok",
        type: "checkbox",
        label: "OK client",
      }),
    ]);

    const added = columns[columns.length - 1]!;
    expect(added.id).toBe("custom-ok");
    expect(added.label).toBe("OK client");
    expect(added.removable).toBe(true);
  });

  it("acceptent des étiquettes entièrement libres", () => {
    const columns = resolveColumns([
      override({
        id: "custom-canal",
        type: "dropdown",
        label: "Canal",
        settings: {
          labels: [{ id: "feed", label: "Feed", color: "#579bfc" }],
        },
      }),
    ]);
    expect(
      columns.find((column) => column.id === "custom-canal")?.labels,
    ).toEqual([{ id: "feed", label: "Feed", color: "#579bfc" }]);
  });

  it("proposent des étiquettes de départ pour un statut", () => {
    expect(defaultLabelsFor("status")).toHaveLength(3);
    expect(defaultLabelsFor("text")).toBeNull();
  });
});

describe("gabarit de grille", () => {
  it("réserve la poignée, les retours et le bouton d'ajout", () => {
    const template = gridTemplate(resolveColumns([]));
    expect(template.startsWith("52px")).toBe(true);
    expect(template.endsWith("40px")).toBe(true);
    // La piste des retours suit celle du sujet.
    expect(template).toContain("minmax(230px,2fr) 40px");
  });

  it("suit les colonnes visibles, et elles seules", () => {
    const hidden = resolveColumns([
      override({ builtin_key: "wording", hidden: true }),
    ]);
    expect(gridTemplate(hidden)).not.toContain("minmax(220px,1.8fr)");
  });
});
