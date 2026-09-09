import { describe, expect, it } from "vitest";

import { describeAdLibraryUrl, parseAdLibraryUrl } from "./ad-library-url";

describe("parseAdLibraryUrl", () => {
  it("lit le pays, la requête, la page et le statut d'une recherche complète", () => {
    expect(
      parseAdLibraryUrl(
        "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=FR&q=lunettes&view_all_page_id=123",
      ),
    ).toEqual({ country: "FR", query: "lunettes", pageId: "123", activeStatus: "active" });
  });

  it("accepte les hôtes sans www, localisés et mobiles", () => {
    for (const host of ["facebook.com", "fr-fr.facebook.com", "m.facebook.com", "web.facebook.com"]) {
      expect(parseAdLibraryUrl(`https://${host}/ads/library/?country=BE&q=opticien`)).toEqual({
        country: "BE",
        query: "opticien",
        pageId: null,
        activeStatus: null,
      });
    }
  });

  it("lit les paramètres dans n'importe quel ordre, en normalisant la casse", () => {
    expect(
      parseAdLibraryUrl("https://www.facebook.com/ads/library?q=Lunettes%20de%20soleil&active_status=ALL&country=fr"),
    ).toEqual({ country: "FR", query: "Lunettes de soleil", pageId: null, activeStatus: "all" });
  });

  it("rend le pays à null sur « ALL », et une page seule sans requête", () => {
    expect(
      parseAdLibraryUrl("https://www.facebook.com/ads/library/?active_status=inactive&country=ALL&view_all_page_id=9876"),
    ).toEqual({ country: null, query: null, pageId: "9876", activeStatus: "inactive" });
  });

  it("refuse tout ce qui n'est pas la Bibliothèque", () => {
    expect(parseAdLibraryUrl("https://www.facebook.com/lunettesbondet")).toBeNull();
    expect(parseAdLibraryUrl("https://www.instagram.com/ads/library/?country=FR")).toBeNull();
    expect(parseAdLibraryUrl("https://notfacebook.com/ads/library/?country=FR")).toBeNull();
    expect(parseAdLibraryUrl("lunettes")).toBeNull();
    expect(parseAdLibraryUrl("")).toBeNull();
  });

  it("écarte un identifiant de page ou un pays malformés sans refuser l'URL", () => {
    expect(
      parseAdLibraryUrl("https://www.facebook.com/ads/library/?country=FRA&view_all_page_id=abc&q=lunettes"),
    ).toEqual({ country: null, query: "lunettes", pageId: null, activeStatus: null });
  });
});

describe("describeAdLibraryUrl", () => {
  it("dit le pays et la requête, ou la page à défaut, et « Tous pays » sans pays", () => {
    expect(describeAdLibraryUrl({ country: "FR", query: "lunettes", pageId: "1", activeStatus: null })).toBe(
      "FR · lunettes",
    );
    expect(describeAdLibraryUrl({ country: null, query: null, pageId: "123", activeStatus: null })).toBe(
      "Tous pays · page 123",
    );
    expect(describeAdLibraryUrl({ country: "BE", query: null, pageId: null, activeStatus: null })).toBe("BE");
  });
});
