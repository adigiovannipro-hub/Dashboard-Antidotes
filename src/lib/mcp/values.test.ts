import { describe, expect, it } from "vitest";

import { parseDay, parseMonth, resolveEditableStatus, resolveFormat } from "./values";

describe("parseMonth", () => {
  it("ramène un mois ou une date au premier du mois", () => {
    expect(parseMonth("2026-11")).toBe("2026-11-01");
    expect(parseMonth("2026-11-15")).toBe("2026-11-01");
  });

  it("refuse un mois illisible", () => {
    expect(() => parseMonth("novembre")).toThrow("Mois illisible");
    expect(() => parseMonth("2026-13")).toThrow("Mois illisible");
  });
});

describe("resolveFormat", () => {
  it("reconnaît les écritures courantes", () => {
    expect(resolveFormat("Carrousel")).toBe("carousel");
    expect(resolveFormat("reels")).toBe("reel");
    expect(resolveFormat("vidéo")).toBe("video");
  });

  it("retombe sur un post", () => {
    expect(resolveFormat(undefined)).toBe("post");
    expect(resolveFormat("thread inconnu")).toBe("post");
  });
});

describe("resolveEditableStatus", () => {
  it("lit la clé comme le libellé, accents et casse compris", () => {
    expect(resolveEditableStatus("in_progress")).toBe("in_progress");
    expect(resolveEditableStatus("En cours")).toBe("in_progress");
    expect(resolveEditableStatus("à valider")).toBe("to_validate");
    expect(resolveEditableStatus("WORDING A FAIRE")).toBe("wording_todo");
  });

  it("refuse la validation et la publication", () => {
    expect(() => resolveEditableStatus("validated")).toThrow(/application/);
    expect(() => resolveEditableStatus("Validé")).toThrow(/application/);
    expect(() => resolveEditableStatus("publié")).toThrow(/application/);
  });

  it("nomme les statuts permis devant un inconnu", () => {
    expect(() => resolveEditableStatus("terminé")).toThrow(/EN COURS/);
  });
});

describe("parseDay", () => {
  it("accepte une vraie date et refuse le reste", () => {
    expect(parseDay("2026-11-04")).toBe("2026-11-04");
    expect(() => parseDay("2026-02-30")).toThrow(/illisible/);
    expect(() => parseDay("04/11/2026")).toThrow(/illisible/);
  });
});
