import { describe, expect, it } from "vitest";

import {
  deriveColumnMapping,
  monthGroupLabel,
  monthLabel,
  normalizeAdStatus,
  normalizeFormat,
  normalizeLabel,
  normalizePlatform,
  normalizeStatus,
  parseBoardName,
  parseMonthLabel,
  parseScheduledOn,
  parseSponsoring,
  parseVisualUrls,
  type MondayColumn,
} from "./monday-mapping";

/** Colonnes de sous-éléments telles qu'elles existent sur le board Bondet. */
const BONDET_COLUMNS: MondayColumn[] = [
  { id: "name", title: "Name", type: "name" },
  { id: "person", title: "Propriétaire", type: "people" },
  { id: "status", title: "Status", type: "status" },
  { id: "dup__of_status", title: "Thématique", type: "status" },
  { id: "date0", title: "Date", type: "date" },
  { id: "fichier", title: "Visuel", type: "file" },
  { id: "texte5", title: "Wording", type: "long_text" },
  { id: "chiffres", title: "Sponsorisation", type: "numbers" },
  { id: "statut", title: "Objectifs", type: "status" },
  { id: "statut0", title: "Statut Ads", type: "status" },
];

/** I-WAY a en plus une colonne Commentaires. */
const IWAY_COLUMNS: MondayColumn[] = [
  ...BONDET_COLUMNS,
  { id: "long_text_mm2v8f3h", title: "Commentaires", type: "long_text" },
];

describe("normalisation des libellés", () => {
  it("écarte accents, casse et espaces superflus", () => {
    expect(normalizeLabel("  Publié ")).toBe("PUBLIE");
    expect(normalizeLabel("À VALIDER")).toBe("A VALIDER");
    expect(normalizeLabel("Wording  à   faire")).toBe("WORDING A FAIRE");
  });

  it("traite l'absence de valeur comme une chaîne vide", () => {
    expect(normalizeLabel(null)).toBe("");
    expect(normalizeLabel(undefined)).toBe("");
  });
});

describe("mois", () => {
  it("accepte les deux orthographes du même mois", () => {
    // Constaté en production : « AOUT » sur un board, « AOÛT » sur un autre.
    expect(parseMonthLabel("AOUT", 2026)).toBe("2026-08-01");
    expect(parseMonthLabel("AOÛT", 2026)).toBe("2026-08-01");
    expect(parseMonthLabel("FÉVRIER", 2026)).toBe("2026-02-01");
    expect(parseMonthLabel("FEVRIER", 2026)).toBe("2026-02-01");
  });

  it("rend null pour un groupe qui n'est pas un mois", () => {
    expect(parseMonthLabel("IDÉES", 2026)).toBeNull();
    expect(parseMonthLabel("À CLASSER", 2026)).toBeNull();
  });

  it("réaffiche un mois lisiblement", () => {
    expect(monthLabel("2026-08-01")).toBe("Août 2026");
    expect(monthLabel("2026-01-01")).toBe("Janvier 2026");
  });

  it("propose un libellé de groupe dans le style du board", () => {
    expect(monthGroupLabel("2026-08-01")).toBe("AOÛT");
    expect(monthGroupLabel("2026-09-01")).toBe("SEPTEMBRE");
  });
});

describe("nom de board", () => {
  it("découpe client, année et archive", () => {
    expect(parseBoardName("LUNETTES BONDET I PE 2026")).toEqual({
      clientName: "LUNETTES BONDET",
      year: 2026,
      isArchive: false,
    });
    expect(parseBoardName("ANMF I PE 2025 [ARCHIVE]")).toEqual({
      clientName: "ANMF",
      year: 2025,
      isArchive: true,
    });
  });

  it("ne se laisse pas piéger par un « I » dans le nom du client", () => {
    expect(parseBoardName("I-WAY I PE 2026")).toEqual({
      clientName: "I-WAY",
      year: 2026,
      isArchive: false,
    });
  });

  it("rend null pour un board hors convention", () => {
    expect(parseBoardName("LUNETTES BONDET I FAQ MODÉRATION")).toBeNull();
    expect(parseBoardName("ANTIDOTES I PIPELINE")).toBeNull();
  });
});

describe("statuts", () => {
  it("couvre les neuf libellés des boards", () => {
    expect(normalizeStatus("EN COURS")).toBe("in_progress");
    expect(normalizeStatus("PUBLIÉ")).toBe("published");
    expect(normalizeStatus("À VALIDER")).toBe("to_validate");
    expect(normalizeStatus("VALIDÉ")).toBe("validated");
    expect(normalizeStatus("EN ATTENTE")).toBe("on_hold");
    expect(normalizeStatus("NON RETENU")).toBe("dropped");
    expect(normalizeStatus("WORDING À FAIRE")).toBe("wording_todo");
    expect(normalizeStatus("PROGRAMMÉ")).toBe("scheduled");
    expect(normalizeStatus("EN BROUILLON")).toBe("draft");
  });

  it("retombe sur « idée » sans statut ou sur un libellé inconnu", () => {
    expect(normalizeStatus(null)).toBe("idea");
    expect(normalizeStatus("")).toBe("idea");
    expect(normalizeStatus("À RETOURNER AU CLIENT")).toBe("idea");
  });
});

describe("formats", () => {
  it("normalise le vocabulaire des boards", () => {
    expect(normalizeFormat("REELS")).toBe("reel");
    expect(normalizeFormat("POST")).toBe("post");
    expect(normalizeFormat("STORIE")).toBe("story");
    expect(normalizeFormat("CARROUSEL")).toBe("carousel");
    expect(normalizeFormat("THREAD")).toBe("thread");
    expect(normalizeFormat("VIDEO")).toBe("video");
    expect(normalizeFormat("DARK")).toBe("dark");
  });

  it("rend « autre » plutôt que d'inventer un format", () => {
    expect(normalizeFormat("LIVE")).toBe("other");
    expect(normalizeFormat(null)).toBe("other");
  });
});

describe("plateformes", () => {
  it("reconnaît les couloirs habituels", () => {
    expect(normalizePlatform("META")).toBe("meta");
    expect(normalizePlatform("LinkedIn")).toBe("linkedin");
    expect(normalizePlatform("TIK TOK")).toBe("tiktok");
    expect(normalizePlatform("X")).toBe("x");
  });

  it("ne fait pas de « DARK » une plateforme", () => {
    // C'est un mode de diffusion. Le couloir garde son nom, sa plateforme
    // reste indéterminée plutôt qu'inventée.
    expect(normalizePlatform("DARK")).toBe("other");
    expect(normalizePlatform("NEWSLETTER")).toBe("other");
  });
});

describe("statut publicitaire", () => {
  it("reconnaît les trois états du board", () => {
    expect(normalizeAdStatus("À faire")).toBe("todo");
    expect(normalizeAdStatus("En cours")).toBe("doing");
    expect(normalizeAdStatus("Fait")).toBe("done");
  });

  it("rend null sans valeur", () => {
    expect(normalizeAdStatus(null)).toBeNull();
    expect(normalizeAdStatus("")).toBeNull();
  });
});

describe("mapping des colonnes", () => {
  it("associe chaque champ à sa colonne", () => {
    const mapping = deriveColumnMapping(BONDET_COLUMNS);
    expect(mapping.status).toBe("status");
    expect(mapping.format).toBe("dup__of_status");
    expect(mapping.date).toBe("date0");
    expect(mapping.wording).toBe("texte5");
    expect(mapping.sponsoring).toBe("chiffres");
    expect(mapping.objective).toBe("statut");
    expect(mapping.adStatus).toBe("statut0");
    expect(mapping.owner).toBe("person");
    expect(mapping.visual).toBe("fichier");
  });

  it("ne confond jamais « Statut Ads » avec « Status »", () => {
    // La correspondance par titre est exacte : une correspondance partielle
    // écraserait le statut de production par celui de la campagne.
    const mapping = deriveColumnMapping([
      { id: "statut0", title: "Statut Ads", type: "status" },
    ]);
    expect(mapping.status).toBeNull();
    expect(mapping.adStatus).toBe("statut0");
  });

  it("laisse à null une colonne que le board n'a pas", () => {
    // Bondet n'a pas de Commentaires, I-WAY oui. C'est une information, pas un
    // oubli de configuration.
    expect(deriveColumnMapping(BONDET_COLUMNS).comments).toBeNull();
    expect(deriveColumnMapping(IWAY_COLUMNS).comments).toBe("long_text_mm2v8f3h");
  });

  it("retombe sur l'identifiant quand la colonne a été renommée", () => {
    const mapping = deriveColumnMapping([
      { id: "texte5", title: "Texte du post", type: "long_text" },
    ]);
    expect(mapping.wording).toBe("texte5");
  });
});

describe("valeurs de colonne", () => {
  it("lit les budgets de sponsorisation", () => {
    expect(parseSponsoring("806.8")).toBe(806.8);
    expect(parseSponsoring("4500")).toBe(4500);
    expect(parseSponsoring("")).toBeNull();
    expect(parseSponsoring(null)).toBeNull();
    expect(parseSponsoring("n/a")).toBeNull();
  });

  it("lit les visuels dans les deux formes rendues par Monday", () => {
    expect(parseVisualUrls("https://a.test/1.png, https://a.test/2.png")).toEqual([
      "https://a.test/1.png",
      "https://a.test/2.png",
    ]);
    expect(parseVisualUrls('{"files":[{"url":"https://a.test/3.png"}]}')).toEqual([
      "https://a.test/3.png",
    ]);
    expect(parseVisualUrls(null)).toEqual([]);
    expect(parseVisualUrls("")).toEqual([]);
  });

  it("lit les dates en ignorant l'heure éventuelle", () => {
    expect(parseScheduledOn("2026-08-03")).toBe("2026-08-03");
    expect(parseScheduledOn("2026-08-03 14:00:00")).toBe("2026-08-03");
    expect(parseScheduledOn(null)).toBeNull();
    expect(parseScheduledOn("")).toBeNull();
  });
});
