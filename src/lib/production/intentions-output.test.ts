import { describe, expect, it } from "vitest";

import {
  formatFromLabel,
  hasSignaledPoints,
  lanePlatformFor,
  parseIntentionsOutput,
  renderCoquilles,
  renderNotes,
  subjectKey,
} from "./intentions-output";

const SORTIE = `PLANNING BONDET OCTOBRE 2026

---
PLATEFORME : META
DATE : 2026-10-02 (vendredi)
FORMAT : Carrousel
NOM : ALMA COULEURS VERRES
STATUT : [À CRÉER]
SPONSO : 50 € | OBJECTIF : Engagement
WORDING :
Alma déclinée en quatre coloris de monture.
Slide 1 : écaille
Slide 2 : noir
Format : 8 visuels, fond crème
SOURCES :
---
---
**PLATEFORME :** META
DATE : 2026-10-06 (mardi)
FORMAT : Post fixe
NOM : AGENDA DU MOIS
STATUT : [EXISTANT]
SPONSO :  | OBJECTIF :
WORDING :
SOURCES : F12, F14
---

RÉCAPITULATIF :
META : 2 (1 existant, 1 créé)

ROTATION :
Carrousel coloris maintenu, Alma remplace Jackie.

POINTS SIGNALÉS :
Aucun

ÉLÉMENTS À MARQUER UTILISÉS :
- F12
`;

describe("parseIntentionsOutput", () => {
  const { items, notes } = parseIntentionsOutput(SORTIE);

  it("lit chaque bloc, dans l'ordre", () => {
    expect(items.map((item) => item.nom)).toEqual(["ALMA COULEURS VERRES", "AGENDA DU MOIS"]);
  });

  it("lit les champs d'un bloc à créer", () => {
    expect(items[0]).toMatchObject({
      plateforme: "META",
      date: "2026-10-02",
      format: "Carrousel",
      statut: "a_creer",
      sponso: 50,
      objectif: "Engagement",
    });
  });

  it("garde le wording sur plusieurs lignes, sans avaler une clé écrite dedans", () => {
    expect(items[0]!.wording).toBe(
      "Alma déclinée en quatre coloris de monture.\nSlide 1 : écaille\nSlide 2 : noir\nFormat : 8 visuels, fond crème",
    );
    expect(items[0]!.format).toBe("Carrousel");
  });

  it("reconnaît une coquille existante, décorations markdown comprises", () => {
    expect(items[1]).toMatchObject({
      plateforme: "META",
      statut: "existant",
      wording: "",
      sponso: null,
      objectif: null,
      sources: "F12, F14",
    });
  });

  it("range les rubriques de fin", () => {
    expect(notes.recapitulatif).toBe("META : 2 (1 existant, 1 créé)");
    expect(notes.rotation).toBe("Carrousel coloris maintenu, Alma remplace Jackie.");
    expect(notes.pointsSignales).toBe("Aucun");
    expect(notes.elementsUtilises).toBe("- F12");
  });

  it("n'ouvre pas une rubrique sur un mot écrit en minuscules dans un wording", () => {
    const { items: seul, notes: rien } = parseIntentionsOutput(
      "PLATEFORME : META\nNOM : X\nWORDING :\nRotation : les montures tournent.\n",
    );
    expect(seul[0]!.wording).toBe("Rotation : les montures tournent.");
    expect(rien.rotation).toBe("");
  });

  it("écarte un bloc sans nom", () => {
    expect(parseIntentionsOutput("PLATEFORME : META\nDATE : 2026-10-01\n").items).toEqual([]);
  });

  it("lit un montant à virgule et des fins de ligne Windows", () => {
    const { items: crlf } = parseIntentionsOutput(
      "PLATEFORME : META\r\nNOM : X\r\nSPONSO : 1 200,50 € | OBJECTIF : Trafic\r\n",
    );
    expect(crlf[0]).toMatchObject({ sponso: 1200.5, objectif: "Trafic" });
  });
});

describe("formatFromLabel", () => {
  it("reprend le rapprochement des livrables", () => {
    expect(formatFromLabel("Post fixe")).toBe("post");
    expect(formatFromLabel("Reels")).toBe("reel");
    expect(formatFromLabel("Carrousel")).toBe("carousel");
  });

  it("se rabat sur un mot contenu", () => {
    expect(formatFromLabel("Quiz story")).toBe("story");
    expect(formatFromLabel("Carrousel produit")).toBe("carousel");
  });

  it("ne devine pas", () => {
    expect(formatFromLabel("Live")).toBe("other");
  });
});

describe("lanePlatformFor", () => {
  it("prend le couloir du réseau nommé quand il existe", () => {
    expect(lanePlatformFor("Instagram", ["instagram", "meta"])).toBe("instagram");
  });

  it("range Instagram sous META quand seul le parapluie existe", () => {
    expect(lanePlatformFor("Instagram", ["meta"])).toBe("meta");
    expect(lanePlatformFor("Meta", ["meta"])).toBe("meta");
  });

  it("ouvre le couloir d'un réseau encore absent", () => {
    expect(lanePlatformFor("LinkedIn", ["meta"])).toBe("linkedin");
  });

  it("retombe sur le seul couloir du mois pour un réseau illisible", () => {
    expect(lanePlatformFor("???", ["meta"])).toBe("meta");
    expect(lanePlatformFor("???", [])).toBe("other");
  });
});

describe("subjectKey", () => {
  it("ignore casse, accents et ponctuation", () => {
    expect(subjectKey("Agenda du mois !")).toBe(subjectKey("AGENDA DU MOIS"));
    expect(subjectKey("Élio")).toBe("elio");
  });
});

describe("renderCoquilles", () => {
  it("dit le wording actuel, ou qu'il est vide", () => {
    const text = renderCoquilles([
      { date: "2026-10-06", platform: "META", format: "Post", name: "B", status: "idea", visuals: 0, wording: null },
      { date: "2026-10-02", platform: "META", format: "Reel", name: "A", status: "idea", visuals: 1, wording: "Montrer\nl'atelier" },
    ]);
    expect(text).toBe(
      "- 2026-10-02 · META · Reel · « A » (statut idea, 1 visuel)\n  Wording actuel : Montrer / l'atelier\n" +
        "- 2026-10-06 · META · Post · « B » (statut idea)\n  Wording actuel : vide",
    );
  });

  it("rend une chaîne vide sans coquille", () => {
    expect(renderCoquilles([])).toBe("");
  });
});

describe("renderNotes", () => {
  it("n'écrit que les rubriques remplies", () => {
    expect(
      renderNotes({ recapitulatif: "META : 9", rotation: "", pointsSignales: "Aucun", elementsUtilises: "" }),
    ).toBe("RÉCAPITULATIF :\nMETA : 9\n\nPOINTS SIGNALÉS :\nAucun");
  });
});

describe("hasSignaledPoints", () => {
  it("ne compte pas « Aucun »", () => {
    const base = { recapitulatif: "", rotation: "", elementsUtilises: "" };
    expect(hasSignaledPoints({ ...base, pointsSignales: "Aucun." })).toBe(false);
    expect(hasSignaledPoints({ ...base, pointsSignales: "" })).toBe(false);
    expect(hasSignaledPoints({ ...base, pointsSignales: "Banque de faits vide." })).toBe(true);
  });
});
