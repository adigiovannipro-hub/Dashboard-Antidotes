import { describe, expect, it } from "vitest";

import { NO_ACCESS, can, hasClientAccess, isPlanningVisible } from "./permissions";

describe("capacités par rôle", () => {
  it("donne tout à l'owner", () => {
    for (const capability of [
      "subject.read",
      "wording.write",
      "sync.pull",
      "sync.push",
      "board.manage",
      "members.manage",
      "strategy.manage",
    ] as const) {
      expect(can("owner", capability)).toBe(true);
    }
  });

  it("laisse l'éditeur travailler sans lui ouvrir l'administration", () => {
    expect(can("editor", "wording.write")).toBe(true);
    // Renvoyer un wording dans Monday fait partie du travail quotidien.
    expect(can("editor", "sync.push")).toBe(true);
    expect(can("editor", "board.manage")).toBe(false);
    expect(can("editor", "members.manage")).toBe(false);
    expect(can("editor", "strategy.manage")).toBe(false);
  });

  it("cantonne le lecteur à la lecture", () => {
    expect(can("viewer", "subject.read")).toBe(true);
    expect(can("viewer", "wording.write")).toBe(false);
    expect(can("viewer", "sync.push")).toBe(false);
    expect(can("viewer", "sync.pull")).toBe(false);
  });
});

describe("visibilité du module", () => {
  it("reste invisible sans aucun client rattaché", () => {
    // C'est le cas de tous les clients du dashboard de reporting : le module
    // ne doit pas même leur apparaître.
    expect(isPlanningVisible(NO_ACCESS)).toBe(false);
  });

  it("apparaît dès qu'un client est rattaché", () => {
    expect(isPlanningVisible({ role: "viewer", clientIds: ["c1"] })).toBe(true);
  });

  it("n'accorde l'accès qu'aux clients listés", () => {
    const access = { role: "editor" as const, clientIds: ["c1", "c2"] };
    expect(hasClientAccess(access, "c1")).toBe(true);
    expect(hasClientAccess(access, "c3")).toBe(false);
  });
});
