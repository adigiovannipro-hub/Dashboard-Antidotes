import { describe, expect, it } from "vitest";

import { kindsForNetwork, planConnexionRows, platformForNetwork } from "./networks";

describe("kindsForNetwork", () => {
  it("rapproche « Facebook » d'une Page", () => {
    // Côté contrat on dit le réseau, côté branchement on affecte une Page.
    expect(kindsForNetwork("Facebook")).toEqual(["facebook_page"]);
  });

  it("réclame les trois comptes pour « Meta »", () => {
    /* Meta est un réseau au sens du contrat — on le vend, on le planifie, et
       la publication part sur Instagram et Facebook d'un geste — mais il
       demande trois branchements. N'en montrer qu'un en laisserait deux
       indispensables invisibles. */
    expect(kindsForNetwork("Meta")).toEqual([
      "instagram",
      "facebook_page",
      "meta_ad_account",
    ]);
  });

  it("ignore la casse et les accents", () => {
    expect(kindsForNetwork("INSTAGRAM")).toEqual(["instagram"]);
    expect(kindsForNetwork(" LinkedIn ")).toEqual(["linkedin"]);
  });

  it("accepte les deux noms de X", () => {
    expect(kindsForNetwork("X")).toEqual(["x"]);
    expect(kindsForNetwork("Twitter")).toEqual(["x"]);
  });

  it("accepte « Tik Tok » écrit en deux mots", () => {
    expect(kindsForNetwork("Tik Tok")).toEqual(["tiktok"]);
  });

  it("ne rend rien pour un livrable qui n'est pas un réseau", () => {
    // Une newsletter est un livrable, pas un compte à brancher.
    expect(kindsForNetwork("Newsletter")).toEqual([]);
  });
});

describe("platformForNetwork", () => {
  it("range un réseau connu sous sa plateforme", () => {
    expect(platformForNetwork("YouTube")).toBe("youtube");
  });

  it("retombe sur « autre » plutôt que d'inventer", () => {
    expect(platformForNetwork("Threads")).toBe("other");
    expect(platformForNetwork("Newsletter")).toBe("other");
  });
});

describe("planConnexionRows", () => {
  it("part des réseaux déclarés, dans l'ordre de saisie", () => {
    const rows = planConnexionRows({
      networks: ["Instagram", "LinkedIn"],
      linked: [],
    });

    expect(rows.slice(0, 2).map((row) => row.kind)).toEqual(["instagram", "linkedin"]);
    expect(rows.slice(0, 2).every((row) => row.declared)).toBe(true);
  });

  it("garde le compte publicitaire même sans être déclaré", () => {
    // Personne ne le déclare aux livrables : ce n'est pas un réseau de
    // publication, c'est lui qui alimente le Reporting.
    const rows = planConnexionRows({ networks: ["Instagram"], linked: [] });
    expect(rows.map((row) => row.kind)).toContain("meta_ad_account");
  });

  it("n'ajoute pas les autres comptes Meta quand rien ne les réclame", () => {
    const rows = planConnexionRows({ networks: ["LinkedIn"], linked: [] });
    expect(rows.map((row) => row.kind)).not.toContain("facebook_page");
  });

  it("reprend une affectation existante absente des livrables", () => {
    // Retirer un réseau du contrat ne doit pas faire disparaître de l'écran
    // un compte qui, lui, continue de publier.
    const rows = planConnexionRows({
      networks: ["Instagram"],
      linked: ["facebook_page"],
    });

    const facebook = rows.find((row) => row.kind === "facebook_page");
    expect(facebook).toBeDefined();
    expect(facebook!.declared).toBe(false);
  });

  it("ne montre pas deux fois le même réseau", () => {
    const rows = planConnexionRows({
      networks: ["Instagram", "instagram", "INSTAGRAM"],
      linked: ["instagram"],
    });

    expect(rows.filter((row) => row.kind === "instagram")).toHaveLength(1);
  });

  it("garde le nom déclaré pour l'affichage", () => {
    const rows = planConnexionRows({ networks: ["Insta"], linked: [] });
    expect(rows[0]!.label).toBe("Insta");
  });

  it("éclate « Meta » en ses trois comptes, groupés sous son nom", () => {
    const rows = planConnexionRows({ networks: ["Meta"], linked: [] });

    expect(rows.map((row) => row.kind)).toEqual([
      "instagram",
      "facebook_page",
      "meta_ad_account",
    ]);
    // Le groupe rappelle qu'une seule déclaration a produit les trois lignes.
    expect(rows.every((row) => row.group === "Meta")).toBe(true);
  });

  it("ne rappelle aucun groupe pour un réseau qui n'en couvre qu'un", () => {
    const rows = planConnexionRows({ networks: ["Instagram"], linked: [] });
    expect(rows[0]!.group).toBeNull();
  });

  it("ne double pas une ligne déclarée deux fois par Meta et par elle-même", () => {
    const rows = planConnexionRows({
      networks: ["Meta", "Instagram"],
      linked: [],
    });

    expect(rows.filter((row) => row.kind === "instagram")).toHaveLength(1);
  });

  it("montre un livrable sans compte, sans prétendre le brancher", () => {
    const rows = planConnexionRows({ networks: ["Newsletter"], linked: [] });
    const ligne = rows.find((row) => row.label === "Newsletter");

    expect(ligne).toBeDefined();
    expect(ligne!.kind).toBeNull();
  });

  it("ignore les noms vides", () => {
    const rows = planConnexionRows({ networks: ["", "   "], linked: [] });
    expect(rows.every((row) => row.kind !== null)).toBe(true);
  });
});
