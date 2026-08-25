import type { SocialAccountKind } from "@/lib/social/types";

/**
 * Les onglets du Reporting : un par réseau du client.
 *
 * Deux sources se croisent, et aucune ne suffit seule :
 *
 *   • **le Contexte** dit sur quels réseaux le client publie. C'est lui qui
 *     donne l'ordre — un client Instagram d'abord ne lit pas son rapport dans
 *     l'ordre alphabétique ;
 *   • **les Connexions** disent ce qu'on sait réellement lire. Un onglet dont
 *     aucun compte n'est branché mènerait à un écran vide sans dire pourquoi,
 *     et un état vide qui ne donne pas de sortie est une impasse.
 *
 * D'où la règle : **un onglet par compte affecté**, rangés dans l'ordre du
 * Contexte. Un réseau déclaré au Contexte mais non branché ne disparaît pas
 * pour autant — il ressort dans `manquants`, pour que l'écran puisse le dire
 * au lieu de faire comme s'il n'existait pas.
 */

export type ReportingNetwork = "meta-ads" | "instagram" | "facebook" | "site-web";

/**
 * Les onglets sociaux — ceux dont la donnée vient d'un compte affecté dans
 * Connexions. « Site Web » n'en est pas un : sa source est une propriété
 * Google Analytics, rattachée à l'espace dans `data_sources`, pas un compte
 * social.
 */
export type SocialReportingNetwork = Exclude<ReportingNetwork, "site-web">;

export const REPORTING_NETWORK_LABELS: Record<ReportingNetwork, string> = {
  "meta-ads": "Meta Ads",
  instagram: "Instagram",
  facebook: "Facebook",
  "site-web": "Site Web",
};

/** Ce que chaque onglet montre, dit en une ligne sous le titre. */
export const REPORTING_NETWORK_SUBTITLES: Record<ReportingNetwork, string> = {
  "meta-ads": "Campagnes payantes — budget, portée, conversions.",
  instagram: "Publications organiques — portée, engagement, abonnés.",
  facebook: "Page organique — portée, engagement, abonnés.",
  "site-web": "Trafic du site — audience, sources, pages vues.",
};

/** Le compte qu'il faut avoir branché pour que l'onglet ait de quoi lire. */
const REQUIRED_KIND: Record<SocialReportingNetwork, SocialAccountKind> = {
  "meta-ads": "meta_ad_account",
  instagram: "instagram",
  facebook: "facebook_page",
};

/**
 * Le nom d'un réseau tel qu'il est écrit dans le Contexte, ramené à une clé.
 *
 * Le champ est du texte libre : « Instagram », « instagram », « Insta »,
 * « Facebook / Meta ». On reconnaît ce qu'on sait reconnaître et on ignore le
 * reste — deviner « Threads » à partir de « Meta » ferait apparaître un onglet
 * que personne n'a demandé.
 */
export function networksFromContextName(name: string): ReportingNetwork[] {
  const folded = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

  if (folded.includes("insta")) return ["instagram"];
  // « Meta Ads » avant « Facebook » : les deux contiennent souvent « meta ».
  // `ads` en **mot entier** : « Threads » contient la suite a-d-s, et un
  // client qui déclare Threads se retrouvait avec un onglet Meta Ads.
  if (/\bads\b/.test(folded) || folded.includes("publicit")) return ["meta-ads"];
  if (folded.includes("facebook") || folded === "fb") return ["facebook"];
  // « Site Web », « Site internet », « Web » : le trafic du site du client.
  if (/\bsite\b/.test(folded) || /\bweb\b/.test(folded)) return ["site-web"];
  /* « Meta » seul est le réseau tel qu'on le vend : payant et organique, les
     deux Pages. Il ouvre donc les trois onglets — c'est ce qu'on attend en
     lisant le rapport d'un client « sur Meta ». Ce test vient en dernier :
     « Meta Ads » a déjà été attrapé plus haut, et ne doit pas tout ouvrir. */
  if (/\bmeta\b/.test(folded)) return ["meta-ads", "instagram", "facebook"];
  return [];
}

export type ReportingTabs = {
  /** Les onglets à afficher, dans l'ordre de lecture. */
  networks: ReportingNetwork[];
  /** Déclarés au Contexte, mais sans compte branché. */
  manquants: ReportingNetwork[];
  /**
   * Déclarés au Contexte et que le Reporting ne sait pas servir du tout —
   * TikTok, LinkedIn : pas de connecteur, donc pas de mesures, donc pas
   * d'onglet possible. Rendus tels qu'écrits pour que l'écran les nomme.
   *
   * Sans cette liste, un client déclaré sur TikTok et LinkedIn ouvrait un
   * Reporting parfaitement vide qui ne disait pas pourquoi — ce qui se lit
   * comme une panne, alors que c'est une fonctionnalité qui n'existe pas
   * encore.
   */
  sansConnecteur: string[];
};

export function resolveReportingNetworks(input: {
  /** Les noms des réseaux déclarés dans le Contexte, dans leur ordre. */
  contextNetworks: readonly string[];
  /** Les types de comptes affectés à cet espace dans Connexions. */
  assignedKinds: readonly SocialAccountKind[];
  /**
   * Une propriété Google Analytics est-elle rattachée à l'espace ? C'est
   * l'équivalent du compte affecté pour l'onglet Site Web — sa source n'est
   * pas un compte social, elle vit dans `data_sources`.
   */
  hasWebSource?: boolean;
}): ReportingTabs {
  const assigned = new Set(input.assignedKinds);
  const hasWebSource = input.hasWebSource ?? false;

  const declared: ReportingNetwork[] = [];
  const sansConnecteur: string[] = [];
  for (const name of input.contextNetworks) {
    const networks = networksFromContextName(name);
    if (networks.length === 0) {
      const label = name.trim();
      if (label.length > 0 && !sansConnecteur.includes(label)) {
        sansConnecteur.push(label);
      }
      continue;
    }
    for (const network of networks) {
      if (!declared.includes(network)) declared.push(network);
    }
  }

  /* Un onglet par réseau **déclaré ou branché**, et non par réseau branché
     seulement. Le contrat commande l'écran : un client vendu sur Meta doit
     voir ses trois onglets dès la signature, même avant qu'un compte soit
     affecté — sinon le Reporting paraît vide sans raison et on ne sait pas
     qu'il reste un geste à faire. L'onglet non branché n'invente rien : il
     porte un état vide qui dit lequel affecter et où. */
  /* « Branché » ne veut pas dire la même chose partout : un compte affecté
     pour les réseaux sociaux, une propriété GA rattachée pour le Site Web. */
  const connected = (network: ReportingNetwork): boolean =>
    network === "site-web" ? hasWebSource : assigned.has(REQUIRED_KIND[network]);

  const networks = (["meta-ads", "instagram", "facebook", "site-web"] as const).filter(
    (network) => connected(network) || declared.includes(network),
  );

  // Ordre fixe — payant, Instagram, Facebook, Site Web — et non l'ordre du
  // Contexte : les onglets doivent tomber au même endroit d'un client à
  // l'autre, sinon on cherche « Meta Ads » à une place différente à chaque
  // espace.
  return {
    networks,
    manquants: networks.filter((network) => !connected(network)),
    sansConnecteur,
  };
}

/** Le compte qu'il faut affecter pour qu'un onglet social ait de quoi lire. */
export function requiredKindFor(network: SocialReportingNetwork): SocialAccountKind {
  return REQUIRED_KIND[network];
}

/** L'onglet demandé par l'URL, ou le premier de la liste. */
export function currentNetwork(
  tabs: ReportingTabs,
  asked: string | undefined,
): ReportingNetwork | null {
  const found = tabs.networks.find((network) => network === asked);
  return found ?? tabs.networks[0] ?? null;
}
