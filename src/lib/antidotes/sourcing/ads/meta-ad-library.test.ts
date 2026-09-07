import { describe, expect, it } from "vitest";

import { adLibraryUrl, createMetaAdsChecker, matchingAds } from "./meta-ad-library";

describe("adLibraryUrl", () => {
  it("demande les annonces actives du pays, sur le nom exact", () => {
    const url = new URL(adLibraryUrl({ company_name: "Optique Saint-Jean", country: "FR", token: "t" }));
    expect(url.pathname).toBe("/v21.0/ads_archive");
    expect(url.searchParams.get("ad_type")).toBe("ALL");
    expect(url.searchParams.get("ad_active_status")).toBe("ACTIVE");
    expect(url.searchParams.get("ad_reached_countries")).toBe('["FR"]');
    expect(url.searchParams.get("search_terms")).toBe("Optique Saint-Jean");
  });
});

describe("matchingAds", () => {
  it("ne garde que les Pages qui portent le nom de la société", () => {
    const matches = matchingAds(
      [
        { id: "1", page_name: "Optique Saint Jean" },
        { id: "2", page_name: "Saint-Jean Immobilier" },
        { id: "3" },
      ],
      "Optique Saint-Jean SARL",
    );
    expect(matches.map((entry) => entry.id)).toEqual(["1"]);
  });
});

describe("createMetaAdsChecker", () => {
  const respond = (body: unknown, status = 200) =>
    (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

  it("dit oui avec la date de la dernière annonce", async () => {
    const check = createMetaAdsChecker({
      token: "t",
      fetcher: respond({
        data: [
          { id: "1", page_name: "Optique Saint-Jean", ad_delivery_start_time: "2026-08-01" },
          { id: "2", page_name: "Optique Saint-Jean", ad_delivery_start_time: "2026-09-01" },
        ],
      }),
    });
    expect(await check({ company_name: "Optique Saint-Jean", country: "FR" })).toEqual({
      active: true,
      last_seen_at: "2026-09-01",
    });
  });

  it("dit non sur une réponse vide, et « on ne sait pas » sur un refus", async () => {
    const no = createMetaAdsChecker({ token: "t", fetcher: respond({ data: [] }) });
    expect(await no({ company_name: "X", country: "FR" })).toEqual({ active: false, last_seen_at: null });

    const refused = createMetaAdsChecker({ token: "t", fetcher: respond({ error: "bad token" }, 401) });
    expect(await refused({ company_name: "X", country: "FR" })).toBeNull();
  });
});
