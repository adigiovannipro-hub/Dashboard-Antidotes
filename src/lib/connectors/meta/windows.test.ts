import { describe, expect, it, vi } from "vitest";

import { collectByChunks, isTooMuchData, splitWindow } from "./windows";

const TROP = "(#1) Please reduce the amount of data you're asking for, then retry your request";

describe("splitWindow", () => {
  it("rend une seule tranche quand la fenêtre tient dans le pas", () => {
    expect(splitWindow({ since: "2026-07-01", until: "2026-07-31" }, 31)).toEqual([
      { since: "2026-07-01", until: "2026-07-31" },
    ]);
  });

  it("découpe une année en tranches mensuelles sans trou ni chevauchement", () => {
    const chunks = splitWindow({ since: "2026-01-01", until: "2026-12-31" }, 31);

    expect(chunks[0]).toEqual({ since: "2026-01-01", until: "2026-01-31" });
    expect(chunks.at(-1)!.until).toBe("2026-12-31");

    // Le piège : un jour qui tombe entre deux tranches ne se verrait que sur
    // la courbe, des semaines plus tard. Chaque tranche reprend au lendemain.
    for (let i = 1; i < chunks.length; i += 1) {
      const finPrecedente = Date.parse(`${chunks[i - 1]!.until}T00:00:00Z`);
      const debut = Date.parse(`${chunks[i]!.since}T00:00:00Z`);
      expect(debut - finPrecedente).toBe(86_400_000);
    }
  });

  it("ne dépasse jamais la borne haute", () => {
    const chunks = splitWindow({ since: "2026-07-01", until: "2026-07-10" }, 7);
    expect(chunks).toEqual([
      { since: "2026-07-01", until: "2026-07-07" },
      { since: "2026-07-08", until: "2026-07-10" },
    ]);
  });

  it("garde les bornes inclusives des deux côtés", () => {
    const chunks = splitWindow({ since: "2026-07-01", until: "2026-07-01" }, 31);
    expect(chunks).toEqual([{ since: "2026-07-01", until: "2026-07-01" }]);
  });

  it("ne rend rien pour une fenêtre à l'envers", () => {
    expect(splitWindow({ since: "2026-07-31", until: "2026-07-01" }, 7)).toEqual([]);
  });
});

describe("isTooMuchData", () => {
  it("reconnaît le refus de volume quel que soit le numéro", () => {
    // Meta le rend tantôt en code 1, tantôt en 100 : c'est la phrase qui tient.
    expect(isTooMuchData(TROP)).toBe(true);
    expect(isTooMuchData("(#100) Please reduce the amount of data you're asking for")).toBe(true);
  });

  it("ne confond pas avec les autres refus", () => {
    expect(isTooMuchData("(#190) Session has expired")).toBe(false);
    expect(isTooMuchData("(#4) rate limit")).toBe(false);
  });
});

describe("collectByChunks", () => {
  const fenetre = { since: "2026-01-01", until: "2026-12-31" };

  it("n'appelle qu'une fois quand la fenêtre entière passe", async () => {
    const run = vi.fn(async () => [1]);
    await expect(collectByChunks(fenetre, run)).resolves.toEqual([1]);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("redescend d'un palier quand Meta trouve la demande trop large", async () => {
    let premier = true;
    const run = vi.fn(async (chunk: { since: string }) => {
      if (premier) {
        premier = false;
        throw new Error(TROP);
      }
      return [chunk.since];
    });

    const rows = await collectByChunks(fenetre, run);
    // La fenêtre entière a échoué, les douze tranches mensuelles ont abouti.
    expect(rows).toHaveLength(12);
    expect(rows[0]).toBe("2026-01-01");
  });

  it("descend jusqu'au jour si les mois sont encore trop lourds", async () => {
    const run = vi.fn(async (chunk: { since: string; until: string }) => {
      if (chunk.since !== chunk.until) throw new Error(TROP);
      return [chunk.since];
    });

    const rows = await collectByChunks({ since: "2026-07-01", until: "2026-07-03" }, run);
    expect(rows).toEqual(["2026-07-01", "2026-07-02", "2026-07-03"]);
  });

  it("laisse remonter toute autre erreur sans se découper", async () => {
    /* Se découper devant un jeton expiré ferait 365 appels pour le même
       refus, et brûlerait le quota au passage. */
    const run = vi.fn(async () => {
      throw new Error("(#190) Session has expired");
    });

    await expect(collectByChunks(fenetre, run)).rejects.toThrow("(#190)");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("appelle les tranches en série, jamais en salve", async () => {
    let enVol = 0;
    let maxEnVol = 0;
    let premier = true;

    const run = vi.fn(async () => {
      if (premier) {
        premier = false;
        throw new Error(TROP);
      }
      enVol += 1;
      maxEnVol = Math.max(maxEnVol, enVol);
      await Promise.resolve();
      enVol -= 1;
      return [1];
    });

    await collectByChunks(fenetre, run);
    // Échanger un refus de volume contre un refus de débit ne réglerait rien.
    expect(maxEnVol).toBe(1);
  });
});
