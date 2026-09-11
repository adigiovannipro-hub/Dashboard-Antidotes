import { describe, expect, it } from "vitest";

import { EMPTY_RAW_METRICS, type RawMetrics } from "@/lib/metrics/types";
import {
  delta,
  hasAnything,
  hasRealData,
  renderOrganicPosts,
  renderReportingFacts,
  rendersPostClicks,
  type OrganicFacts,
  type ReportingFacts,
} from "./reporting-facts";
import type { MeasuredPost } from "./wording-performance";

const post = (overrides: Partial<MeasuredPost> = {}): MeasuredPost => ({
  caption: "Nos nouveaux verres arrivent.\n\nEn trois teintes.\n\nRéservez votre essayage.",
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

const metrics = (overrides: Partial<RawMetrics> = {}): RawMetrics => ({
  ...EMPTY_RAW_METRICS,
  ...overrides,
});

const organic = (overrides: Partial<OrganicFacts> = {}): OrganicFacts => ({
  platform: "instagram",
  posts: 0,
  previousPosts: 0,
  total: metrics(),
  previousTotal: metrics(),
  followers: null,
  previousFollowers: null,
  top: [],
  flop: [],
  ...overrides,
});

const facts = (overrides: Partial<ReportingFacts> = {}): ReportingFacts => ({
  month: "2026-07-01",
  ads: null,
  organic: [],
  planning: [],
  previousPlanning: [],
  ...overrides,
});

describe("delta", () => {
  it("dit « N/A » quand il n'y a rien des deux côtés", () => {
    expect(delta(0, 0)).toBe("N/A");
  });

  it("dit « nouveau » plutôt qu'une hausse infinie", () => {
    // Un client dont le mois précédent est à zéro afficherait « +Infinity % ».
    expect(delta(11, 0)).toBe("nouveau");
  });

  it("signe les hausses et laisse le moins aux baisses", () => {
    expect(delta(11, 8)).toBe("+37,5\u202f%");
    expect(delta(8, 11)).toBe("-27,3\u202f%");
  });
});

describe("hasRealData", () => {
  it("ne compte pas un planning comme une donnée de régie", () => {
    expect(
      hasRealData(facts({ planning: [{ platform: "META", planned: 9, published: 8 }] })),
    ).toBe(false);
  });

  it("suffit d'un compte publicitaire", () => {
    expect(
      hasRealData(facts({ ads: { total: metrics(), previousTotal: metrics() } })),
    ).toBe(true);
  });

  it("un relevé d'abonnés seul est une donnée, même sans publication", () => {
    // Le cas Facebook : Meta réserve la lecture des publications d'une Page à
    // son App Review, mais les abonnés se lisent sans elle.
    expect(hasRealData(facts({ organic: [organic({ followers: 295 })] }))).toBe(true);
  });

  it("un compte relevé mais vide ne compte pas", () => {
    expect(hasRealData(facts({ organic: [organic()] }))).toBe(false);
  });
});

describe("hasAnything", () => {
  it("un planning seul suffit à écrire un compte rendu", () => {
    expect(
      hasAnything(facts({ planning: [{ platform: "META", planned: 9, published: 8 }] })),
    ).toBe(true);
  });

  it("rien du tout ne suffit à rien", () => {
    expect(hasAnything(facts())).toBe(false);
  });
});

describe("renderReportingFacts", () => {
  it("recalcule les ratios depuis les agrégats, jamais depuis un stock", () => {
    const rendu = renderReportingFacts(
      facts({
        ads: {
          total: metrics({
            spend: 572.29,
            impressions: 10000,
            linkClicks: 250,
            clicks: 400,
            purchases: 11,
            purchaseValue: 466.3,
          }),
          previousTotal: metrics({ spend: 500, purchases: 8, purchaseValue: 300 }),
        },
      }),
    );
    // 466,30 / 572,29 = 0,81 — le ROAS du vrai compte I-WAY.
    expect(rendu).toContain("ROAS : 0,81");
    expect(rendu).toContain("Coût par achat : 52,03\u202f€");
    expect(rendu).toContain("CTR : 2,50\u202f%");
    expect(rendu).toContain("Achats : 11 (+37,5\u202f%)");
  });

  it("dit qu'aucun compte publicitaire n'est branché plutôt que de se taire", () => {
    const rendu = renderReportingFacts(facts());
    expect(rendu).toContain("Aucun compte publicitaire branché");
    expect(rendu).toContain("Aucun compte social relevé");
  });

  it("avertit quand le compte rendu ne repose que sur le planning", () => {
    const rendu = renderReportingFacts(
      facts({ planning: [{ platform: "META", planned: 12, published: 8 }] }),
    );
    expect(rendu).toContain("Aucune donnée de régie n'est disponible");
    expect(rendu).toContain("META : 8 publiés sur 12 prévus");
  });

  it("ne pose pas l'avertissement dès qu'une source réelle existe", () => {
    const rendu = renderReportingFacts(
      facts({ ads: { total: metrics({ spend: 10 }), previousTotal: metrics() } }),
    );
    expect(rendu).not.toContain("Aucune donnée de régie");
  });

  it("calcule le taux d'engagement sur les vues quand la portée manque, et le dit", () => {
    // Meta ne rend pas toujours la portée d'une publication : sans ce repli,
    // le taux serait « — » sur un mois pourtant mesuré.
    const rendu = renderReportingFacts(
      facts({
        organic: [
          organic({ posts: 4, total: metrics({ videoViews: 1000, likes: 50 }) }),
        ],
      }),
    );
    expect(rendu).toContain("calculé sur les vues, portée absente");
    expect(rendu).toContain("Taux d'engagement : 5,00\u202f%");
  });

  it("affiche « — » pour une portée absente, jamais un zéro", () => {
    const rendu = renderReportingFacts(
      facts({ organic: [organic({ posts: 2, total: metrics({ likes: 3 }) })] }),
    );
    expect(rendu).toContain("Portée : —");
  });
});

describe("rendersPostClicks", () => {
  it("n'accorde les clics par publication qu'à LinkedIn", () => {
    // `social_posts.clicks` reste à zéro sur Meta : c'est une absence de
    // mesure, pas une absence de clic.
    expect(rendersPostClicks("linkedin")).toBe(true);
    expect(rendersPostClicks("instagram")).toBe(false);
    expect(rendersPostClicks("facebook")).toBe(false);
    expect(rendersPostClicks("tiktok")).toBe(false);
  });
});

describe("renderOrganicPosts", () => {
  it("rend la légende entière, son accroche et son appel à l'action", () => {
    const rendu = renderOrganicPosts(facts({ organic: [organic({ posts: 1, top: [post()] })] }));
    expect(rendu).toContain("accroche : « Nos nouveaux verres arrivent. »");
    expect(rendu).toContain("appel à l'action : « Réservez votre essayage. »");
    expect(rendu).toContain("légende publiée :");
  });

  it("dit que les clics ne sont pas rendus plutôt que d'écrire zéro", () => {
    const rendu = renderOrganicPosts(facts({ organic: [organic({ posts: 1, top: [post()] })] }));
    expect(rendu).toContain("clics non rendus");
    expect(rendu).not.toContain("clics 0");
  });

  it("sépare les plus engageantes des moins engageantes", () => {
    const rendu = renderOrganicPosts(
      facts({
        organic: [
          organic({
            platform: "linkedin",
            posts: 2,
            top: [post({ platform: "LinkedIn", clicks: 60 })],
            flop: [post({ caption: "Accroche molle.", platform: "LinkedIn", clicks: 1, likes: 1, comments: 0, shares: 0, saves: 0 })],
          }),
        ],
      }),
    );
    expect(rendu).toContain("Les plus engageantes sur LinkedIn :");
    expect(rendu).toContain("Les moins engageantes sur LinkedIn (mesurées) :");
    expect(rendu).toContain("clics 60");
  });

  it("ne rend rien quand aucun réseau n'a de publication mesurée", () => {
    expect(renderOrganicPosts(facts({ organic: [organic()] }))).toBe("");
  });
});

describe("renderReportingFacts (clics par publication)", () => {
  it("nomme le réseau qui ne rend pas les clics au lieu d'afficher zéro", () => {
    const rendu = renderReportingFacts(facts({ organic: [organic({ posts: 3 })] }));
    expect(rendu).toContain("Clics par publication : non rendus par ce réseau");
  });

  it("affiche les clics de LinkedIn, seule source qui les rende", () => {
    const rendu = renderReportingFacts(
      facts({
        organic: [
          organic({
            platform: "linkedin",
            posts: 3,
            total: metrics({ reach: 1000, clicks: 120 }),
            previousTotal: metrics({ reach: 800, clicks: 100 }),
          }),
        ],
      }),
    );
    expect(rendu).toContain("## Organique — LinkedIn");
    expect(rendu).toContain("Clics : 120 (+20,0\u202f%)");
  });
});
