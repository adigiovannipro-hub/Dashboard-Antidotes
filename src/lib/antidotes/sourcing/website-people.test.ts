import { describe, expect, it } from "vitest";

import { extractPeopleFromHtml, htmlToText } from "./website-people";

describe("htmlToText", () => {
  it("retire balises, scripts et entités", () => {
    expect(htmlToText("<p>Bonjour&nbsp;<b>Camille</b></p><script>x()</script><p>Roux</p>")).toBe(
      "Bonjour Camille\nRoux",
    );
  });
});

describe("extractPeopleFromHtml", () => {
  it("lit le directeur de la publication d'une page de mentions légales", () => {
    const people = extractPeopleFromHtml(
      "<h2>Mentions légales</h2><p>Éditeur : Optique Saint-Jean SARL</p><p>Directeur de la publication : Mme Camille Roux</p>",
    );
    expect(people).toEqual([
      { first_name: "Camille", last_name: "Roux", role: "Directeur de la publication", source: "website" },
    ]);
  });

  it("lit un nom en capitales dans l'ordre nom prénom", () => {
    const people = extractPeopleFromHtml("<p>Gérant : ROUX Jean-Pierre</p>");
    expect(people[0]).toMatchObject({ first_name: "Jean-Pierre", last_name: "Roux", role: "Gérant" });
  });

  it("lit « Nom, poste » sur une page équipe, sans doublon", () => {
    const people = extractPeopleFromHtml(
      "<ul><li>Nora Diallo – Responsable marketing</li><li>Nora Diallo, responsable marketing</li><li>Marc Petit - Fondateur</li></ul>",
    );
    expect(people.map((person) => `${person.first_name} ${person.last_name}`)).toEqual([
      "Nora Diallo",
      "Marc Petit",
    ]);
    expect(people[1]?.role).toBe("Fondateur");
  });

  it("ne prend pas une société ou un mot commun pour une personne", () => {
    expect(
      extractPeopleFromHtml("<p>Directeur de la publication : La Société Optique</p><p>Gérant : SARL</p>"),
    ).toEqual([]);
  });
});
