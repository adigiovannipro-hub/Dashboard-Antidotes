import { describe, expect, it } from "vitest";

import {
  dailyFromShareStats,
  followerGains,
  followersFromNetworkSize,
  followersHistory,
  organizationId,
  pagesFromOrganizations,
  permalinkOf,
  postsFromRest,
  statsByPost,
} from "./mapping";

/* Les charges utiles sont recopiées des réponses **réelles** relevées le
   2 septembre 2026 contre la page ANMF, par le passage HTTP brut. Inventer
   une forme aurait reconduit le défaut qu'on corrige : le parseur d'origine
   cherchait des ACL là où la passerelle rend des fiches. */

const FICHE = {
  id: 1988476,
  localizedName: "ANMF I La Meunerie Française",
  vanityName: "anmf",
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
    expect(pagesFromOrganizations(FICHE)).toEqual([
      { id: "1988476", name: "ANMF I La Meunerie Française", vanityName: "anmf", logoUrl: null },
    ]);
  });

  it("lit une liste de fiches", () => {
    const pages = pagesFromOrganizations({
      elements: [FICHE, { id: 10088549, localizedName: "I-WAY" }],
    });
    expect(pages.map((page) => page.id)).toEqual(["1988476", "10088549"]);
  });

  it("lit une liste d'ACL portant l'URN, sans nom résolu", () => {
    expect(
      pagesFromOrganizations({
        elements: [{ organization: "urn:li:organization:72408812", role: "ADMINISTRATOR" }],
      }),
    ).toEqual([{ id: "72408812", name: "Page 72408812", vanityName: null, logoUrl: null }]);
  });

  it("rend une liste vide sur une forme inconnue, sans jeter", () => {
    expect(pagesFromOrganizations({ paging: { total: 0 } })).toEqual([]);
    expect(pagesFromOrganizations(null)).toEqual([]);
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

describe("dailyFromShareStats", () => {
  const payload = {
    paging: { start: 0, count: 50, links: [], total: 2 },
    elements: [
      {
        totalShareStatistics: {
          uniqueImpressionsCount: 1316,
          shareCount: 0,
          engagement: 0.053983456682629515,
          clickCount: 71,
          likeCount: 53,
          impressionCount: 2297,
          commentCount: 0,
        },
        organizationalEntity: "urn:li:organization:1988476",
        timeRange: { start: 1785715200000, end: 1785801600000 },
      },
      {
        totalShareStatistics: {
          uniqueImpressionsCount: 938,
          shareCount: -1,
          clickCount: 67,
          likeCount: 26,
          impressionCount: 1555,
          commentCount: 1,
        },
        organizationalEntity: "urn:li:organization:1988476",
        timeRange: { start: 1785801600000, end: 1785888000000 },
      },
    ],
  };

  it("date chaque jour depuis son intervalle, jamais depuis son rang", () => {
    const days = dailyFromShareStats(payload);
    expect(days.map((day) => day.date)).toEqual(["2026-08-03", "2026-08-04"]);
  });

  it("lit les six grandeurs additives", () => {
    expect(dailyFromShareStats(payload)[0]).toEqual({
      date: "2026-08-03",
      impressions: 2297,
      reach: 1316,
      clicks: 71,
      likes: 53,
      comments: 0,
      shares: 0,
    });
  });

  it("borne à zéro : LinkedIn rend −1 pour « je ne sais pas »", () => {
    expect(dailyFromShareStats(payload)[1]?.shares).toBe(0);
  });
});

describe("statsByPost", () => {
  it("indexe les statistiques par URN de publication", () => {
    const stats = statsByPost({
      paging: { start: 0, count: 10, links: [], total: 1 },
      elements: [
        {
          ugcPost: "urn:li:ugcPost:7498754246121615360",
          totalShareStatistics: {
            uniqueImpressionsCount: 505,
            shareCount: 2,
            clickCount: 101,
            likeCount: 19,
            impressionCount: 717,
            commentCount: 0,
          },
          organizationalEntity: "urn:li:organization:1988476",
        },
      ],
    });

    expect(stats.get("urn:li:ugcPost:7498754246121615360")).toEqual({
      impressions: 717,
      reach: 505,
      clicks: 101,
      likes: 19,
      comments: 0,
      shares: 2,
    });
  });
});

describe("followerGains", () => {
  it("additionne l'organique et le payant, mois par mois", () => {
    const gains = followerGains({
      elements: [
        {
          followerGains: { organicFollowerGain: 92, paidFollowerGain: 0 },
          timeRange: { start: 1754092800000, end: 1756684800000 },
        },
        {
          followerGains: { organicFollowerGain: 98, paidFollowerGain: 4 },
          timeRange: { start: 1756684800000, end: 1759276800000 },
        },
      ],
    });

    // LinkedIn fait commencer le premier intervalle au lendemain de la borne
    // demandée : le mois s'ancre sur le 1er, pas sur la date brute.
    expect(gains).toEqual([
      { month: "2025-08-01", gain: 92 },
      { month: "2025-09-01", gain: 102 },
    ]);
  });
});

describe("followersHistory", () => {
  it("remonte le temps depuis le compte du jour et les gains", () => {
    const points = followersHistory(
      [
        { month: "2026-07-01", gain: 50 },
        { month: "2026-08-01", gain: 92 },
      ],
      6711,
      "2026-09-01",
    );

    // Le point d'un mois est daté du dernier jour qu'il clôture, et vaut le
    // compte d'aujourd'hui moins les gains survenus depuis.
    expect(points).toEqual([
      { date: "2026-07-31", followers: 6569 },
      { date: "2026-08-31", followers: 6619 },
    ]);
  });

  it("ne date rien au-delà du jour clôturé : le mois en cours n'a pas de fin", () => {
    const points = followersHistory(
      [
        { month: "2026-08-01", gain: 92 },
        { month: "2026-09-01", gain: 12 },
      ],
      6711,
      "2026-09-01",
    );
    expect(points.map((point) => point.date)).toEqual(["2026-08-31"]);
  });

  it("s'arrête plutôt que de rendre un compte négatif", () => {
    expect(followersHistory([{ month: "2026-08-01", gain: 999 }], 10, "2026-09-01")).toEqual(
      [],
    );
  });
});

describe("postsFromRest", () => {
  const payload = {
    paging: { start: 0, count: 3, links: [], total: 627 },
    elements: [
      {
        lifecycleState: "PUBLISHED",
        publishedAt: 1788162303984,
        author: "urn:li:organization:1988476",
        id: "urn:li:ugcPost:7498754246121615360",
        content: { media: { title: "Charte RSE", id: "urn:li:document:D4E1FAQ" } },
        commentary: "En 2024, 76 % des entreprises de la meunerie…",
      },
      {
        lifecycleState: "DRAFT",
        publishedAt: 1788162303984,
        id: "urn:li:ugcPost:brouillon",
      },
      {
        lifecycleState: "PUBLISHED",
        publishedAt: 1788000000000,
        id: "urn:li:ugcPost:video",
        content: { media: { id: "urn:li:video:C4E10AQ" } },
      },
    ],
  };

  it("lit les publications parues", () => {
    const posts = postsFromRest(payload);
    expect(posts.map((post) => post.urn)).toEqual([
      "urn:li:ugcPost:7498754246121615360",
      "urn:li:ugcPost:video",
    ]);
  });

  it("écarte les brouillons : ils n'ont pas de performance à montrer", () => {
    expect(postsFromRest(payload).some((post) => post.urn.endsWith("brouillon"))).toBe(
      false,
    );
  });

  it("déduit le type de média du contenu, faute que LinkedIn le nomme", () => {
    const posts = postsFromRest(payload);
    expect(posts[0]?.mediaKind).toBe("image");
    expect(posts[1]?.mediaKind).toBe("video");
    expect(
      postsFromRest({
        elements: [
          {
            lifecycleState: "PUBLISHED",
            publishedAt: 1788000000000,
            id: "urn:li:ugcPost:carrousel",
            content: { multiImage: { images: [{}, {}] } },
          },
        ],
      })[0]?.mediaKind,
    ).toBe("carousel");
  });
});

describe("permalinkOf", () => {
  it("fabrique le lien public depuis l'URN — LinkedIn n'en rend pas", () => {
    expect(permalinkOf("urn:li:ugcPost:7498754246121615360")).toBe(
      "https://www.linkedin.com/feed/update/urn:li:ugcPost:7498754246121615360/",
    );
  });
});
