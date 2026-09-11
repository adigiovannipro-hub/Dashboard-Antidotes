import { describe, expect, it } from "vitest";

import { countsAsPending, isSpam } from "./types";

describe("countsAsPending", () => {
  it("compte un fil à traiter qu'on n'a pas encore lu", () => {
    expect(countsAsPending({ status: "to_process", unread: true })).toBe(true);
  });

  it("ne compte plus un fil lu — c'est ce qui rendait « Tout lire » sans effet", () => {
    expect(countsAsPending({ status: "to_process", unread: false })).toBe(false);
  });

  it("ne compte pas un fil déjà traité, même non lu", () => {
    expect(countsAsPending({ status: "answered", unread: true })).toBe(false);
  });

  it("ne compte pas un spam : il a quitté « À traiter », le badge le suit", () => {
    expect(countsAsPending({ status: "to_process", unread: true, flags: ["spam"] })).toBe(false);
  });

  it("compte un fil signalé pour autre chose que du spam", () => {
    expect(
      countsAsPending({ status: "to_process", unread: true, flags: ["remboursement"] }),
    ).toBe(true);
  });
});

describe("isSpam", () => {
  it("reconnaît le drapeau, quel que soit son voisinage", () => {
    expect(isSpam(["insulte", "spam"])).toBe(true);
  });

  it("tolère l'absence de drapeaux", () => {
    expect(isSpam(null)).toBe(false);
    expect(isSpam(undefined)).toBe(false);
    expect(isSpam([])).toBe(false);
  });
});
