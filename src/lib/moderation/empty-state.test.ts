import { describe, expect, it } from "vitest";

import { describeEmptyState } from "./empty-state";

const BASE = {
  connections: 3,
  everPolled: true,
  filtered: false,
  segment: "a-traiter" as const,
};

describe("describeEmptyState", () => {
  it("sans compte branché, dit où en brancher un", () => {
    const state = describeEmptyState({ ...BASE, connections: 0 });
    expect(state.title).toBe("Aucun compte branché");
    expect(state.action).toBe("brancher");
  });

  it("l'absence de compte prime sur tout le reste", () => {
    // Des filtres posés sur une boîte qui n'a jamais rien pu relever : c'est
    // le branchement qui manque, pas le filtre.
    const state = describeEmptyState({
      connections: 0,
      everPolled: false,
      filtered: true,
      segment: "traitees",
    });
    expect(state.action).toBe("brancher");
  });

  it("branché mais jamais relevé, propose de relever", () => {
    const state = describeEmptyState({ ...BASE, everPolled: false });
    expect(state.title).toBe("Jamais relevé");
    expect(state.action).toBe("relever");
  });

  it("avec des filtres posés, propose de les retirer", () => {
    const state = describeEmptyState({ ...BASE, filtered: true });
    expect(state.action).toBe("reinitialiser");
  });

  it("une boîte à jour n'est pas une erreur : rien à faire", () => {
    const state = describeEmptyState(BASE);
    expect(state.title).toBe("Tout est traité");
    expect(state.action).toBeNull();
    expect(state.hint).toBe("");
  });

  it("les deux autres segments disent ce qu'ils contiennent", () => {
    expect(describeEmptyState({ ...BASE, segment: "en-attente" }).title).toBe(
      "Rien en attente",
    );
    expect(describeEmptyState({ ...BASE, segment: "traitees" }).title).toBe(
      "Rien de traité",
    );
  });
});
