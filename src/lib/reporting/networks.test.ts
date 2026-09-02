import { describe, expect, it } from "vitest";

import {
  currentNetwork,
  networksFromContextName,
  providersForNetwork,
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

  it("distingue le payant de l'organique sur LinkedIn et TikTok", () => {
    // « LinkedIn Ads » ouvrait l'onglet LinkedIn : le compte publicitaire
    // n'avait nulle part où aller.
    expect(networksFromContextName("LinkedIn Ads")).toEqual(["linkedin-ads"]);
    expect(networksFromContextName("LinkedIn")).toEqual(["linkedin"]);
    expect(networksFromContextName("TikTok Ads")).toEqual(["tiktok-ads"]);
    expect(networksFromContextName("Tik Tok")).toEqual(["tiktok"]);
    // Et « Meta Ads » reste Meta Ads, pas LinkedIn.
    expect(networksFromContextName("Meta Ads")).toEqual(["meta-ads"]);
  });

  it("reconnaît le site web du client", () => {
    expect(networksFromContextName("Site Web")).toEqual(["site-web"]);
    expect(networksFromContextName("Site internet")).toEqual(["site-web"]);
    expect(networksFromContextName("web")).toEqual(["site-web"]);
  });

  it("ne devine pas un réseau qu'elle ne connaît pas", () => {
    expect(networksFromContextName("Threads")).toEqual([]);
    expect(networksFromContextName("Pinterest")).toEqual([]);
    expect(networksFromContextName("")).toEqual([]);
    // « Website » n'est pas « web » en mot entier — on ne devine pas.
    expect(networksFromContextName("Webtoon")).toEqual([]);
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

  it("ouvre un onglet aux réseaux déclarés même sans connecteur", () => {
    // Le cas d'I-WAY : TikTok et LinkedIn au contrat. L'onglet existe —
    // il porte la courbe d'abonnés reprise de Looker, ou dit qu'il attend
    // son connecteur — dans l'ordre fixe, pas celui du Contexte.
    const tabs = resolveReportingNetworks({
      contextNetworks: ["TikTok", "LinkedIn"],
      assignedKinds: [],
    });

    expect(tabs.networks).toEqual(["linkedin", "tiktok"]);
    expect(tabs.sansConnecteur).toEqual([]);
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

  it("ouvre Site Web dès qu'une propriété GA est rattachée, en dernier", () => {
    const tabs = resolveReportingNetworks({
      contextNetworks: ["Instagram"],
      assignedKinds: ["instagram"],
      hasWebSource: true,
    });

    expect(tabs.networks).toEqual(["instagram", "site-web"]);
    expect(tabs.manquants).toEqual([]);
  });

  it("ouvre Site Web déclaré au Contexte même sans propriété rattachée", () => {
    const tabs = resolveReportingNetworks({
      contextNetworks: ["Site Web"],
      assignedKinds: [],
    });

    expect(tabs.networks).toEqual(["site-web"]);
    // Il est là, et l'écran sait qu'il lui manque sa propriété.
    expect(tabs.manquants).toEqual(["site-web"]);
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

describe("providersForNetwork", () => {
  it("réserve l'erreur Google Analytics à l'onglet Site Web", () => {
    expect(providersForNetwork("site-web")).toEqual(["google_analytics"]);
    expect(providersForNetwork("meta-ads")).not.toContain("google_analytics");
    expect(providersForNetwork("instagram")).not.toContain("google_analytics");
    expect(providersForNetwork("facebook")).not.toContain("google_analytics");
  });

  it("relie chaque onglet social à son fournisseur", () => {
    expect(providersForNetwork("meta-ads")).toEqual(["meta_ads"]);
    expect(providersForNetwork("instagram")).toEqual(["meta_organic"]);
    expect(providersForNetwork("facebook")).toEqual(["meta_organic"]);
  });
});

describe("providersForNetwork — payant hors Meta", () => {
  it("donne au payant LinkedIn et TikTok un fournisseur à lui", () => {
    expect(providersForNetwork("linkedin-ads")).toEqual(["linkedin_ads"]);
    expect(providersForNetwork("tiktok-ads")).toEqual(["tiktok_ads"]);
    expect(providersForNetwork("linkedin")).toEqual(["linkedin_organic"]);
  });
});
