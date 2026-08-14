import { describe, expect, it } from "vitest";

import {
  currentNetwork,
  networkFromContextName,
  resolveReportingNetworks,
} from "./networks";

describe("networkFromContextName", () => {
  it("reconnaît Instagram quelle que soit la casse et les accents", () => {
    expect(networkFromContextName("Instagram")).toBe("instagram");
    expect(networkFromContextName("instagram")).toBe("instagram");
    expect(networkFromContextName("Insta")).toBe("instagram");
  });

  it("reconnaît le payant avant Facebook", () => {
    expect(networkFromContextName("Meta Ads")).toBe("meta-ads");
    expect(networkFromContextName("Publicité Meta")).toBe("meta-ads");
  });

  it("reconnaît la Page Facebook", () => {
    expect(networkFromContextName("Facebook")).toBe("facebook");
    expect(networkFromContextName("fb")).toBe("facebook");
  });

  it("ne devine pas un réseau qu'elle ne connaît pas", () => {
    expect(networkFromContextName("Threads")).toBeNull();
    expect(networkFromContextName("Pinterest")).toBeNull();
    expect(networkFromContextName("")).toBeNull();
  });
});

describe("resolveReportingNetworks", () => {
  it("range les onglets dans l'ordre du Contexte", () => {
    const tabs = resolveReportingNetworks({
      contextNetworks: ["Instagram", "Facebook"],
      assignedKinds: ["meta_ad_account", "facebook_page", "instagram"],
    });

    expect(tabs.networks).toEqual(["instagram", "facebook", "meta-ads"]);
  });

  it("garde un compte branché que le Contexte ne nomme pas", () => {
    const tabs = resolveReportingNetworks({
      contextNetworks: ["Instagram"],
      assignedKinds: ["instagram", "meta_ad_account"],
    });

    expect(tabs.networks).toEqual(["instagram", "meta-ads"]);
    expect(tabs.manquants).toEqual([]);
  });

  it("n'ouvre pas d'onglet vers un réseau sans compte branché", () => {
    const tabs = resolveReportingNetworks({
      contextNetworks: ["Instagram", "Facebook"],
      assignedKinds: ["instagram"],
    });

    expect(tabs.networks).toEqual(["instagram"]);
    // Il ne disparaît pas pour autant : l'écran doit pouvoir le dire.
    expect(tabs.manquants).toEqual(["facebook"]);
  });

  it("ne rend rien quand aucun compte n'est affecté", () => {
    const tabs = resolveReportingNetworks({
      contextNetworks: ["Instagram"],
      assignedKinds: [],
    });

    expect(tabs.networks).toEqual([]);
    expect(tabs.manquants).toEqual(["instagram"]);
  });

  it("ignore un doublon du Contexte", () => {
    const tabs = resolveReportingNetworks({
      contextNetworks: ["Instagram", "Insta"],
      assignedKinds: ["instagram"],
    });

    expect(tabs.networks).toEqual(["instagram"]);
  });
});

describe("currentNetwork", () => {
  const tabs = {
    networks: ["instagram", "meta-ads"] as const,
    manquants: [],
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
    expect(currentNetwork({ networks: [], manquants: [] }, undefined)).toBeNull();
  });
});
