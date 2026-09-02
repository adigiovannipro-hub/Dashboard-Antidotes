import { describe, expect, it } from "vitest";

import {
  deltaBetween,
  followersFromNetworkSize,
  lifetimeFromShareStats,
  organizationId,
  pagesFromOrganizations,
} from "./mapping";

/* Les charges utiles sont recopiées des réponses **réelles** relevées le
   2 septembre 2026 contre le compte de l'agence — pages ANMF et Koré
   Clinic. Inventer une forme aurait reconduit le défaut qu'on corrige : le
   parseur d'origine cherchait des ACL là où la passerelle rend des fiches. */

const FICHE_ORGANISATION = {
  id: 1988476,
  localizedName: "ANMF I La Meunerie Française",
  vanityName: "anmf",
  logoV2: { original: "urn:li:digitalmediaAsset:D4E0BAQ" },
};

describe("organizationId", () => {
  it("extrait l'identifiant numérique d'un URN d'organisation", () => {
    expect(organizationId("urn:li:organization:1988476")).toBe("1988476");
  });

  it("refuse un URN d'un autre type", () => {
    expect(organizationId("urn:li:person:gpy86V1zb7")).toBeNull();
  });
});

describe("pagesFromOrganizations", () => {
  it("lit une fiche d'organisation seule — la forme que rend la passerelle", () => {
    expect(pagesFromOrganizations(FICHE_ORGANISATION)).toEqual([
      {
        id: "1988476",
        name: "ANMF I La Meunerie Française",
        vanityName: "anmf",
        logoUrl: "urn:li:digitalmediaAsset:D4E0BAQ",
      },
    ]);
  });

  it("lit une liste de fiches", () => {
    const pages = pagesFromOrganizations({
      elements: [FICHE_ORGANISATION, { id: 10088549, localizedName: "I-WAY" }],
    });
    expect(pages.map((page) => page.id)).toEqual(["1988476", "10088549"]);
  });

  it("lit une liste d'ACL portant l'URN, sans nom résolu", () => {
    const pages = pagesFromOrganizations({
      elements: [{ organization: "urn:li:organization:72408812", role: "ADMINISTRATOR" }],
    });
    expect(pages).toEqual([
      { id: "72408812", name: "Page 72408812", vanityName: null, logoUrl: null },
    ]);
  });

  it("prend le nom localisé quand le nom direct manque", () => {
    const pages = pagesFromOrganizations({
      id: 11077863,
      name: { localized: { fr_FR: "OMA" } },
    });
    expect(pages[0]?.name).toBe("OMA");
  });

  it("rend une liste vide sur une forme inconnue, sans jeter", () => {
    expect(pagesFromOrganizations({ paging: { total: 0 } })).toEqual([]);
    expect(pagesFromOrganizations(null)).toEqual([]);
    expect(pagesFromOrganizations("refusé")).toEqual([]);
  });
});

describe("followersFromNetworkSize", () => {
  it("lit le nombre d'abonnés", () => {
    expect(followersFromNetworkSize({ firstDegreeSize: 6711 })).toBe(6711);
  });

  it("rend null plutôt que zéro quand la réponse n'en porte pas", () => {
    expect(followersFromNetworkSize({})).toBeNull();
  });
});

describe("lifetimeFromShareStats", () => {
  it("lit les compteurs cumulés d'une page", () => {
    const payload = {
      elements: [
        {
          organizationalEntity: "urn:li:organization:1988476",
          totalShareStatistics: {
            clickCount: 59001,
            commentCount: 123,
            engagement: 0.13482008942396634,
            impressionCount: 494051,
            likeCount: 7436,
            shareCount: 48,
            uniqueImpressionsCount: 206950,
          },
        },
      ],
      paging: { count: 10, links: [], start: 0, total: 1 },
    };

    expect(lifetimeFromShareStats(payload)).toEqual({
      impressions: 494051,
      reach: 206950,
      clicks: 59001,
      likes: 7436,
      comments: 123,
      shares: 48,
    });
  });

  it("rend null sur une page sans statistiques, jamais six zéros", () => {
    expect(lifetimeFromShareStats({ elements: [] })).toBeNull();
    expect(lifetimeFromShareStats({})).toBeNull();
  });
});

describe("deltaBetween", () => {
  const veille = {
    impressions: 494051,
    reach: 206950,
    clicks: 59001,
    likes: 7436,
    comments: 123,
    shares: 48,
  };

  it("rend ce qui s'est passé entre deux relevés", () => {
    expect(
      deltaBetween(veille, { ...veille, impressions: 495000, likes: 7440 }),
    ).toEqual({
      impressions: 949,
      reach: 0,
      clicks: 0,
      likes: 4,
      comments: 0,
      shares: 0,
    });
  });

  it("borne à zéro : un compteur ne recule pas, LinkedIn corrige", () => {
    expect(deltaBetween(veille, { ...veille, impressions: 490000 })?.impressions).toBe(0);
  });

  it("rend null sans relevé antérieur — jamais le cumul pris pour un mois", () => {
    expect(deltaBetween(null, veille)).toBeNull();
    expect(deltaBetween(veille, null)).toBeNull();
  });
});
