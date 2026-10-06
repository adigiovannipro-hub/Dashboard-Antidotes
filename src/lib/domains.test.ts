import { describe, expect, it } from "vitest";

import { isVitrineHost, routeVitrine } from "./domains";

const APP = "https://app.antidotes.agency";

describe("isVitrineHost", () => {
  it("reconnaît la racine et www, port et casse ignorés", () => {
    expect(isVitrineHost("antidotes.agency")).toBe(true);
    expect(isVitrineHost("www.antidotes.agency")).toBe(true);
    expect(isVitrineHost("Antidotes.Agency:443")).toBe(true);
  });

  it("laisse l'application, les déploiements Vercel et localhost à l'application", () => {
    expect(isVitrineHost("app.antidotes.agency")).toBe(false);
    expect(isVitrineHost("dashboard-antidotes-beta.vercel.app")).toBe(false);
    expect(isVitrineHost("localhost:3000")).toBe(false);
    expect(isVitrineHost(null)).toBe(false);
  });

  it("ne se laisse pas tromper par un domaine qui finit pareil", () => {
    expect(isVitrineHost("evilantidotes.agency")).toBe(false);
    expect(isVitrineHost("antidotes.agency.example.com")).toBe(false);
  });
});

describe("routeVitrine", () => {
  it("sert la page noire à la racine", () => {
    expect(routeVitrine("/", "", APP)).toEqual({ kind: "page" });
  });

  it("sert les deux pages légales elle-même", () => {
    expect(routeVitrine("/confidentialite", "", APP)).toEqual({ kind: "served" });
    expect(routeVitrine("/cgu", "", APP)).toEqual({ kind: "served" });
  });

  it("ne prend pas un chemin voisin pour une page légale", () => {
    expect(routeVitrine("/cguv", "", APP)).toEqual({
      kind: "app",
      url: `${APP}/cguv`,
    });
  });

  it("renvoie tout le reste vers l'application, au même chemin et requête comprise", () => {
    expect(routeVitrine("/login", "", APP)).toEqual({
      kind: "app",
      url: `${APP}/login`,
    });
    expect(
      routeVitrine("/espace/anmf/meta", "?du=2026-09-01&au=2026-09-30", APP),
    ).toEqual({
      kind: "app",
      url: `${APP}/espace/anmf/meta?du=2026-09-01&au=2026-09-30`,
    });
  });

  it("tolère une origine écrite avec une barre finale", () => {
    expect(routeVitrine("/inbox", "", `${APP}/`)).toEqual({
      kind: "app",
      url: `${APP}/inbox`,
    });
  });
});
