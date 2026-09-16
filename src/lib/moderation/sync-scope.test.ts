import { describe, expect, it } from "vitest";

import {
  backfillsProfiles,
  conversationSince,
  conversationWindowDays,
  directMessageStepBudget,
  parseSyncScope,
  usesPostCursors,
} from "./sync-scope";

describe("directMessageStepBudget", () => {
  it("n'accorde qu'un palier au relevé du jour — la route Vercel a soixante secondes", () => {
    // Un palier vaut au plus un appel de 45 s, et c'est le palier réduit,
    // celui qui passe quand la boîte passe.
    expect(directMessageStepBudget("jour")).toBe(1);
  });

  it("en accorde trois au relevé complet, jamais cinq", () => {
    // Cinq paliers rejoués trois fois faisaient 700 s par Page refusée.
    expect(directMessageStepBudget("complet")).toBe(3);
  });
});

describe("conversationWindowDays", () => {
  it("donne deux jours au relevé du jour, pas un", () => {
    // Un cron GitHub saute près d'une exécution sur deux, le passage tourne en
    // UTC et Meta antidate parfois un fil : un seul jour laisserait un trou.
    expect(conversationWindowDays("jour")).toBe(2);
  });

  it("garde soixante jours au relevé complet", () => {
    expect(conversationWindowDays("complet")).toBe(60);
  });
});

describe("conversationSince", () => {
  it("recule de deux jours en UTC pour le relevé du jour", () => {
    expect(conversationSince("jour", new Date("2026-09-11T05:00:00Z"))).toBe(
      "2026-09-09",
    );
  });

  it("traverse un changement de mois sans se tromper", () => {
    expect(conversationSince("jour", new Date("2026-09-01T23:30:00Z"))).toBe(
      "2026-08-30",
    );
  });

  it("recule de soixante jours pour le relevé complet", () => {
    expect(conversationSince("complet", new Date("2026-09-11T05:00:00Z"))).toBe(
      "2026-07-13",
    );
  });
});

describe("usesPostCursors", () => {
  it("saute les publications inchangées au relevé du jour", () => {
    expect(usesPostCursors("jour")).toBe(true);
  });

  it("redescend tout la nuit — c'est la passe de réparation", () => {
    expect(usesPostCursors("complet")).toBe(false);
  });
});

describe("backfillsProfiles", () => {
  it("ne rattrape ni photo ni auteur masqué au relevé du jour", () => {
    // Ce sont des appels un par un : ils n'apportent rien à qui ouvre son
    // écran pour voir les fils du jour.
    expect(backfillsProfiles("jour")).toBe(false);
  });

  it("les rattrape au relevé complet", () => {
    expect(backfillsProfiles("complet")).toBe(true);
  });
});

describe("parseSyncScope", () => {
  it("reconnaît les deux portées", () => {
    expect(parseSyncScope("jour")).toBe("jour");
    expect(parseSyncScope("complet")).toBe("complet");
  });

  it("tolère la casse et les espaces d'un champ de workflow", () => {
    expect(parseSyncScope("  Complet ")).toBe("complet");
  });

  it("rend null sur une valeur inconnue ou absente", () => {
    // Le défaut appartient à l'appelant : l'écran relève le jour, le script
    // relève tout.
    expect(parseSyncScope("tout")).toBeNull();
    expect(parseSyncScope(undefined)).toBeNull();
    expect(parseSyncScope(2)).toBeNull();
  });
});
