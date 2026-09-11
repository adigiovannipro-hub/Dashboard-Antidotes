import { describe, expect, it } from "vitest";

import {
  clickRate,
  engagementRate,
  interactionsOf,
  isMeasured,
  matchByCaption,
  rankByClickRate,
  rankByEngagement,
  renderFormulasToDrop,
  renderMeasuredWordings,
  renderTopPostsSummary,
  renderWinningCtas,
  renderWinningHooks,
  splitCaption,
  type MeasuredPost,
} from "./wording-performance";

const post = (overrides: Partial<MeasuredPost> = {}): MeasuredPost => ({
  caption: "Une accroche.\n\nUn corps de texte.\n\nDécouvrez la collection en boutique.",
  publishedAt: "2026-07-08",
  platform: "Instagram",
  mediaKind: "Reel",
  reach: 1000,
  impressions: 1200,
  likes: 40,
  comments: 5,
  shares: 3,
  saves: 2,
  clicks: null,
  permalink: null,
  ...overrides,
});

describe("splitCaption", () => {
  it("prend la première ligne pleine comme accroche", () => {
    const parts = splitCaption("Nos nouveaux verres arrivent.\n\nEn trois teintes.\n\nVenez voir.");
    expect(parts.hook).toBe("Nos nouveaux verres arrivent.");
  });

  it("reconnaît un appel à l'action à l'impératif en fin de légende", () => {
    const parts = splitCaption("Le titre.\n\nLe corps.\n\nRéservez votre essayage en boutique.");
    expect(parts.cta).toBe("Réservez votre essayage en boutique.");
    expect(parts.body).toBe("Le corps.");
  });

  it("reconnaît une question finale comme appel à l'action", () => {
    const parts = splitCaption("Le titre.\n\nUn fait.\n\nEt vous, quelle monture préférez-vous ?");
    expect(parts.cta).toBe("Et vous, quelle monture préférez-vous ?");
  });

  it("rend null quand la légende ne porte aucun appel à l'action", () => {
    // Une légende sans CTA est une information utile, pas un trou à combler.
    const parts = splitCaption("Le titre.\n\nUn constat sur la lumière bleue.\n\nC'est tout.");
    expect(parts.cta).toBeNull();
    expect(parts.body).toContain("C'est tout.");
  });

  it("ne prend pas un verbe au milieu d'une phrase pour une injonction", () => {
    const parts = splitCaption("Le titre.\n\nNous découvrons chaque saison de nouvelles montures.");
    expect(parts.cta).toBeNull();
  });

  it("ignore un bloc de hashtags terminal", () => {
    const parts = splitCaption(
      "Le titre.\n\nPassez nous voir.\n\n#lunettes #opticien #lyon",
    );
    expect(parts.cta).toBe("Passez nous voir.");
  });

  it("laisse au corps la phrase qui précède le CTA sur la même ligne", () => {
    const parts = splitCaption(
      "Le titre.\n\nTrois coloris disponibles. Réservez le vôtre.",
    );
    expect(parts.cta).toBe("Réservez le vôtre.");
    expect(parts.body).toBe("Trois coloris disponibles.");
  });

  it("reconnaît « lien en bio » sans verbe à l'impératif", () => {
    const parts = splitCaption("Le titre.\n\nLe corps.\n\nTout est dans le lien en bio.");
    expect(parts.cta).toBe("Tout est dans le lien en bio.");
  });
});

describe("interactionsOf", () => {
  it("additionne les quatre interactions, jamais les impressions", () => {
    expect(interactionsOf(post())).toBe(50);
  });
});

describe("isMeasured", () => {
  it("retient une publication dont seules les impressions sont rendues", () => {
    expect(isMeasured(post({ reach: 0, impressions: 900 }))).toBe(true);
  });

  it("écarte une publication que le réseau n'a pas mesurée", () => {
    // Portée et impressions à zéro : c'est un trou, pas une contre-performance.
    expect(isMeasured(post({ reach: 0, impressions: 0 }))).toBe(false);
  });
});

describe("engagementRate", () => {
  it("recalcule le taux sur la somme des portées, pas la moyenne des taux", () => {
    // 100 000 vues pour 100 interactions, 100 vues pour 50 : la moyenne des
    // taux donnerait 25,05 %, le taux sur les agrégats 0,15 %.
    const rate = engagementRate([
      post({ reach: 100000, likes: 100, comments: 0, shares: 0, saves: 0 }),
      post({ reach: 100, likes: 50, comments: 0, shares: 0, saves: 0 }),
    ]);
    expect(rate).toBeCloseTo(0.1499, 3);
  });

  it("rend null quand rien n'est mesuré", () => {
    expect(engagementRate([post({ reach: 0, impressions: 0 })])).toBeNull();
  });
});

describe("clickRate", () => {
  it("rend null quand aucun réseau ne rend les clics", () => {
    // Tout Meta est dans ce cas : un 0 % s'y lirait comme un échec des CTA.
    expect(clickRate([post({ clicks: null })])).toBeNull();
  });

  it("ne compte que les publications dont les clics sont rendus", () => {
    const rate = clickRate([post({ reach: 1000, clicks: 50 }), post({ clicks: null })]);
    expect(rate).toBeCloseTo(5, 6);
  });
});

describe("rankByEngagement", () => {
  it("classe par taux et non par volume brut", () => {
    const big = post({ caption: "Grosse portée.", reach: 100000, likes: 200, comments: 0, shares: 0, saves: 0 });
    const small = post({ caption: "Petite portée.", reach: 1000, likes: 100, comments: 0, shares: 0, saves: 0 });
    expect(rankByEngagement([big, small], { limit: 2 }).map((entry) => entry.caption)).toEqual([
      "Petite portée.",
      "Grosse portée.",
    ]);
  });

  it("n'écrit jamais une publication non mesurée dans les flops", () => {
    const trou = post({ caption: "Non mesurée.", reach: 0, impressions: 0 });
    const faible = post({ caption: "Faible.", reach: 5000, likes: 1, comments: 0, shares: 0, saves: 0 });
    const worst = rankByEngagement([trou, faible], { limit: 2, worst: true });
    expect(worst.map((entry) => entry.caption)).toEqual(["Faible."]);
  });
});

describe("rankByClickRate", () => {
  it("écarte les publications dont le réseau ne rend pas les clics", () => {
    const linkedin = post({ caption: "LinkedIn.", clicks: 80 });
    const meta = post({ caption: "Meta.", clicks: null });
    expect(rankByClickRate([linkedin, meta], { limit: 5 }).map((e) => e.caption)).toEqual([
      "LinkedIn.",
    ]);
  });
});

describe("matchByCaption", () => {
  it("rapproche un sujet du planning de sa publication par le texte publié", () => {
    const publie = post({ caption: "Nos nouveaux verres photochromiques arrivent en boutique." });
    const match = matchByCaption(
      [publie, post({ caption: "Tout autre chose, vraiment très différent ici." })],
      "Nos nouveaux verres photochromiques arrivent en boutique.\n\nVenez les essayer.",
    );
    expect(match?.caption).toBe(publie.caption);
  });

  it("ne tranche pas une correspondance ambiguë", () => {
    // Deux publications au même début : imputer les chiffres de l'une au texte
    // de l'autre est exactement la faute qu'on s'interdit.
    const texte = "Nos nouveaux verres photochromiques arrivent en boutique.";
    expect(matchByCaption([post({ caption: texte }), post({ caption: texte })], texte)).toBeNull();
  });

  it("ne rapproche rien sur un texte trop court pour être discriminant", () => {
    expect(matchByCaption([post({ caption: "Promo" })], "Promo")).toBeNull();
  });
});

describe("renderMeasuredWordings", () => {
  it("rend le texte publié et le chiffre qui l'étaye", () => {
    const rendu = renderMeasuredWordings([post({ caption: "Le titre.\n\nRéservez en boutique." })]);
    expect(rendu).toContain("Réservez en boutique.");
    expect(rendu).toContain("1 000 de portée");
    expect(rendu).toContain("50 interactions");
  });

  it("rend une chaîne vide quand rien n'est mesuré", () => {
    expect(renderMeasuredWordings([post({ reach: 0, impressions: 0 })])).toBe("");
  });
});

describe("renderWinningHooks", () => {
  it("ferme sur un taux recalculé sur la somme des portées", () => {
    const rendu = renderWinningHooks([post()]);
    expect(rendu).toContain("recalculé sur la somme des portées");
    expect(rendu).toContain("5,00 %");
  });
});

describe("renderWinningCtas", () => {
  it("dit que les clics ne sont pas rendus plutôt que de classer sur un zéro", () => {
    const rendu = renderWinningCtas([post({ clicks: null })]);
    expect(rendu).toContain("ne rend les clics par publication");
    expect(rendu).toContain("clics non rendus par le réseau");
  });

  it("classe par clic dès qu'un réseau les rend", () => {
    const rendu = renderWinningCtas([
      post({ caption: "A.\n\nCliquez ici pour en savoir plus.", reach: 1000, clicks: 100 }),
      post({ caption: "B.\n\nCliquez là pour tout voir.", reach: 1000, clicks: 5 }),
    ]);
    expect(rendu).not.toContain("ne rend les clics par publication");
    expect(rendu.indexOf("Cliquez ici")).toBeLessThan(rendu.indexOf("Cliquez là"));
  });
});

describe("renderFormulasToDrop", () => {
  it("ne retire rien sur un échantillon trop maigre", () => {
    // Trois publications mesurées : « les moins bonnes » ne sont que les autres.
    expect(renderFormulasToDrop([post(), post(), post()])).toBe("");
  });

  it("nomme l'accroche et le CTA des publications les moins engageantes", () => {
    const faible = post({
      caption: "Accroche molle.\n\nPartagez en story.",
      reach: 10000,
      likes: 1,
      comments: 0,
      shares: 0,
      saves: 0,
    });
    const rendu = renderFormulasToDrop([faible, post(), post(), post()], { limit: 1 });
    expect(rendu).toContain("Accroche molle.");
    expect(rendu).toContain("Partagez en story.");
  });
});

describe("renderTopPostsSummary", () => {
  it("donne une ligne par publication, accroche et CTA compris", () => {
    const rendu = renderTopPostsSummary([post()]);
    expect(rendu).toContain("Instagram · Reel");
    expect(rendu).toContain("accroche « Une accroche. »");
    expect(rendu).toContain("CTA « Découvrez la collection en boutique. »");
  });

  it("dit qu'une publication n'avait pas de CTA", () => {
    const rendu = renderTopPostsSummary([post({ caption: "Juste un constat.\n\nRien de plus." })]);
    expect(rendu).toContain("sans appel à l'action");
  });
});
