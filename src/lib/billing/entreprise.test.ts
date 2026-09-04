import { describe, expect, it } from "vitest";

import { sirenFrom } from "./entreprise";

describe("sirenFrom", () => {
  it("tire le SIREN d'un numéro de TVA français", () => {
    // Le cas courant : on copie le numéro de TVA d'une facture reçue.
    expect(sirenFrom("FR94452373269")).toBe("452373269");
  });

  it("tire le SIREN d'un SIRET, qui désigne un établissement", () => {
    expect(sirenFrom("45237326900025")).toBe("452373269");
  });

  it("accepte un SIREN nu", () => {
    expect(sirenFrom("452373269")).toBe("452373269");
  });

  it("ignore les espaces et les points d'un copier-coller", () => {
    expect(sirenFrom("FR 94 452 373 269")).toBe("452373269");
    expect(sirenFrom("452.373.269")).toBe("452373269");
  });

  it("admet une clé de TVA qui porte une lettre", () => {
    // Certaines clés sont alphanumériques : les refuser écarterait des
    // entreprises parfaitement valides.
    expect(sirenFrom("FRK7452373269")).toBe("452373269");
  });

  it("rend null sur ce qui n'est pas un identifiant", () => {
    expect(sirenFrom("MEDIAPILOTE")).toBeNull();
    expect(sirenFrom("1234")).toBeNull();
    expect(sirenFrom("")).toBeNull();
  });
});
