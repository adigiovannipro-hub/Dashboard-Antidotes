import { describe, expect, it } from "vitest";

import { resolveSourceParams } from "../config";
import { createMapsEngine, mapMapsPlace, mapsActorInput } from "./maps";

const place = {
  title: "Optique Saint-Jean",
  website: "https://optique-saint-jean.fr/",
  phone: "+33 4 72 00 00 00",
  city: "Lyon",
  postalCode: "69005",
  countryCode: "fr",
  totalScore: 4.63,
  reviewsCount: 98,
  placeId: "ChIJabc",
  categoryName: "Opticien",
};

describe("mapMapsPlace", () => {
  it("rend une société avec ses signaux de taille et de qualité", () => {
    expect(mapMapsPlace(place, "FR")).toEqual({
      company_name: "Optique Saint-Jean",
      website: "https://optique-saint-jean.fr/",
      country: "FR",
      city: "Lyon",
      postal_code: "69005",
      sector: "Opticien",
      rating: 4.6,
      reviews_count: 98,
      phone: "+33 4 72 00 00 00",
      external_ids: { place_id: "ChIJabc" },
    });
  });

  it("écarte un lieu sans nom ou fermé, et tolère les champs absents", () => {
    expect(mapMapsPlace({ title: "" }, "FR")).toBeNull();
    expect(mapMapsPlace({ ...place, permanentlyClosed: true }, "FR")).toBeNull();
    expect(mapMapsPlace({ title: "Sans rien" }, "FR")).toMatchObject({
      country: "FR",
      rating: null,
      reviews_count: null,
      external_ids: {},
    });
  });
});

describe("createMapsEngine", () => {
  it("interroge l'acteur par ville et dédoublonne par identifiant de lieu", async () => {
    const calls: { url: string; body: unknown }[] = [];
    const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify([place, { ...place, title: "Doublon" }, { title: "Autre", placeId: "x2" }]), {
        status: 200,
      });
    }) as typeof fetch;

    const engine = createMapsEngine({ token: "secret", fetcher });
    const companies = await engine(
      resolveSourceParams({ keywords: ["opticien"], cities: ["Lyon", "Villeurbanne"], max_places: 20 }),
    );

    expect(calls).toHaveLength(2);
    expect(calls[0]?.url).toContain("compass~crawler-google-places/run-sync-get-dataset-items");
    expect(calls[0]?.url).toContain("token=secret");
    expect(calls[0]?.body).toEqual(
      mapsActorInput(resolveSourceParams({ keywords: ["opticien"], cities: ["Lyon"], max_places: 20 }), "Lyon"),
    );
    expect(companies.map((company) => company.company_name)).toEqual(["Optique Saint-Jean", "Autre"]);
  });

  it("rend l'erreur d'Apify avec son statut", async () => {
    const fetcher = (async () => new Response("Actor not found", { status: 404 })) as typeof fetch;
    const engine = createMapsEngine({ token: "secret", fetcher });
    await expect(engine(resolveSourceParams({ keywords: ["x"], cities: ["Lyon"] }))).rejects.toThrow(
      /Apify Google Maps : 404/,
    );
  });
});
