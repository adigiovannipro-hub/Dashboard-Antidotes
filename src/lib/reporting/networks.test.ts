import { describe, expect, it } from "vitest";

import {
  currentNetwork,
  networksFromContextName,
  resolveReportingNetworks,
} from "./networks";

describe("networksFromContextName", () => {
  it("reconnaît Instagram quelle que soit la casse et les accents", () => {
    expect(networksFromContextName("Instagram")).toEqual(["instagram"]);
    expect(networksFromContextName("instagram")).toEqual(["instagram"]);
    expect(networksFromContextName("Insta")).toEqual(["instagram"]);
  });

  it("reconnaît le payant avant Facebook", () => {
    expect(networksFromContextName("Meta Ads")).toEqual(["meta-ads"]);
    expect(networksFromContextName("Publicité Meta")).toEqual(["meta-ads"]);
  });

  it("reconnaît la Page Facebook", () => {
    expect(networksFromContextName("Facebook")).toEqual(["facebook"]);
    expect(networksFromContextName("fb")).toEqual(["facebook"]);
  });

  it("ouvre les trois onglets pour « Meta » seul", () => {
    // C'est ainsi qu'on vend Meta : payant et organique, les deux Pages.
    expect(networksFromContextName("Meta")).toEqual([
      "meta-ads",
      "instagram",
      "facebook",
    ]);
  });

  it("ne confond pas « Meta » et « Meta Ads »", () => {
    // « Meta Ads » ne doit pas ouvrir l'organique : c'est le payant seul.
    expect(networksFromContextName("Meta Ads")).toEqual(["meta-ads"]);
  });

  it("ne devine pas un réseau qu'elle ne connaît pas", () => {
    expect(networksFromContextName("Threads")).toEqual([]);
    expect(networksFromContextName("Pinterest")).toEqual([]);
    expect(networksFromContextName("")).toEqual([]);
  });
});

describe("resolveReportingNetworks", () => {
  it("garde un ordre fixe, quel que soit celui du Contexte", () => {
    const tabs = resolveReportingNetworks({
      contextNetworks: ["Facebook", "Instagram"],
      assignedKinds: ["facebook_page", "instagram", "meta_ad_account"],
    });

    expect(tabs.networks).toEqual(["meta-ads", "instagram", "facebook"]);
  });

  it("garde un compte branché que le Contexte ne nomme pas", () => {
    const tabs = resolveReportingNetworks({
      contextNetworks: ["Instagram"],
      assignedKinds: ["instagram", "meta_ad_account"],
    });

    expect(tabs.networks).toEqual(["meta-ads", "instagram"]);
    expect(tabs.manquants).toEqual([]);
  });

  it("ouvre les trois onglets d'un client déclaré sur Meta", () => {
    const tabs = resolveReportingNetworks({
      contextNetworks: ["Meta"],
      assignedKinds: [],
    });

    expect(tabs.networks).toEqual(["meta-ads", "instagram", "facebook"]);
  });

  it("ouvre l'onglet déclaré même sans compte affecté", () => {
    /* Le contrat commande l'écran : sans ça, un client vendu sur Meta ouvrait
       un Reporting vide qui ne disait pas qu'il restait un geste à faire. */
    const tabs = resolveReportingNetworks({
      contextNetworks: ["Instagram", "Facebook"],
      assignedKinds: ["instagram"],
    });

    expect(tabs.networks).toEqual(["instagram", "facebook"]);
    // Il est là, et l'écran sait qu'il lui manque son compte.
    expect(tabs.manquants).toEqual(["facebook"]);
  });

  it("nomme les réseaux qu'aucun connecteur ne sert", () => {
    // Le cas d'I-WAY : TikTok et LinkedIn au contrat, zéro connecteur.
    const tabs = resolveReportingNetworks({
      contextNetworks: ["TikTok", "LinkedIn"],
      assignedKinds: [],
    });

    expect(tabs.networks).toEqual([]);
    expect(tabs.sansConnecteur).toEqual(["TikTok", "LinkedIn"]);
  });

  it("rend les noms tels que le client les a écrits", () => {
    const tabs = resolveReportingNetworks({
      contextNetworks: ["Newsletter"],
      assignedKinds: [],
    });

    expect(tabs.sansConnecteur).toEqual(["Newsletter"]);
  });

  it("ignore un doublon du Contexte", () => {
    const tabs = resolveReportingNetworks({
      contextNetworks: ["Instagram", "Insta"],
      assignedKinds: ["instagram"],
    });

    expect(tabs.networks).toEqual(["instagram"]);
  });

  it("ne rend aucun onglet quand rien n'est déclaré ni branché", () => {
    const tabs = resolveReportingNetworks({
      contextNetworks: [],
      assignedKinds: [],
    });

    expect(tabs.networks).toEqual([]);
    expect(tabs.sansConnecteur).toEqual([]);
  });
});

describe("currentNetwork", () => {
  const tabs = {
    networks: ["instagram", "meta-ads"] as const,
    manquants: [],
    sansConnecteur: [],
  };

  it("suit l'URL quand l'onglet demandé existe", () => {
    expect(currentNetwork({ ...tabs, networks: [...tabs.networks] }, "meta-ads")).toBe(
      "meta-ads",
    );
  });

  it("retombe sur le premier onglet quand l'URL demande l'inconnu", () => {
    expect(
      currentNetwork({ ...tabs, networks: [...tabs.networks] }, "tiktok"),
    ).toBe("instagram");
  });

  it("ne rend rien quand il n'y a aucun onglet", () => {
    expect(
      currentNetwork({ networks: [], manquants: [], sansConnecteur: [] }, undefined),
    ).toBeNull();
  });
});
