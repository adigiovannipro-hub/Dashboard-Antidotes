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

export type ReportingNetwork =
  | "meta-ads"
  | "instagram"
  | "facebook"
  | "linkedin"
  | "linkedin-ads"
  | "tiktok"
  | "tiktok-ads"
  | "youtube"
  | "x"
  | "site-web";

/** Les onglets payants : un compte publicitaire, des campagnes, un budget. */
export const PAID_NETWORKS: readonly ReportingNetwork[] = [
  "meta-ads",
  "linkedin-ads",
  "tiktok-ads",
];

export function isPaidNetwork(network: ReportingNetwork): boolean {
  return PAID_NETWORKS.includes(network);
}

/**
 * Les onglets sociaux — ceux dont la donnée vient d'un compte affecté dans
 * Connexions. « Site Web » n'en est pas un : sa source est une propriété
 * Google Analytics, rattachée à l'espace dans `data_sources`, pas un compte
 * social.
 */
export type SocialReportingNetwork = Exclude<ReportingNetwork, "site-web">;

/**
 * Les réseaux qu'un connecteur sait lire aujourd'hui. Les autres s'ajoutent
 * quand même par le « + » : l'onglet existe, dit qu'il attend son connecteur,
 * et la courbe d'abonnés s'affiche dès qu'un relevé existe (reprise Looker,
 * TikTok par exemple).
 */
const WITH_CONNECTOR: readonly ReportingNetwork[] = [
  "meta-ads",
  "instagram",
  "facebook",
  "site-web",
];

export function hasConnector(network: ReportingNetwork): boolean {
  return WITH_CONNECTOR.includes(network);
}

export const REPORTING_NETWORK_LABELS: Record<ReportingNetwork, string> = {
  "meta-ads": "Meta Ads",
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  "linkedin-ads": "LinkedIn Ads",
  tiktok: "TikTok",
  "tiktok-ads": "TikTok Ads",
  youtube: "YouTube",
  x: "X",
  "site-web": "Site Web",
};

/**
 * Les fournisseurs de `data_sources` dont chaque onglet dépend.
 *
 * Le bandeau d'erreur de la page filtrait par espace mais pas par onglet : le
 * refus d'une clé Composio — qui ne concerne que le Site Web — s'affichait
 * aussi sur Meta Ads, Instagram et Facebook, où les chiffres étaient pourtant
 * complets. Une alerte posée sur des chiffres sains fait accuser les chiffres.
 *
 * `meta_organic` sert deux onglets : le connecteur crée une source par compte
 * affecté (Instagram, Page), toutes deux sous ce fournisseur — on ne sait pas
 * les départager sans deviner sur le nom, donc on ne devine pas.
 */
export function providersForNetwork(network: ReportingNetwork): string[] {
  if (network === "site-web") return ["google_analytics"];
  if (network === "meta-ads") return ["meta_ads"];
  if (network === "instagram" || network === "facebook") return ["meta_organic"];
  // Le payant d'un réseau a son fournisseur à lui, comme `meta_ads`.
  if (network === "linkedin-ads") return ["linkedin_ads"];
  if (network === "tiktok-ads") return ["tiktok_ads"];
  // Un fournisseur par réseau, même sans connecteur : la reprise Looker range
  // déjà ses relevés sous ces slugs (`tiktok_organic` vit en base).
  return [`${network}_organic`];
}

/** Le compte qu'il faut avoir branché pour que l'onglet ait de quoi lire. */
const REQUIRED_KIND: Record<SocialReportingNetwork, SocialAccountKind> = {
  "meta-ads": "meta_ad_account",
  instagram: "instagram",
  facebook: "facebook_page",
  linkedin: "linkedin",
  "linkedin-ads": "linkedin_ad_account",
  tiktok: "tiktok",
  "tiktok-ads": "tiktok_ad_account",
  youtube: "youtube",
  x: "x",
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
  /* Le payant d'un réseau se dit « <réseau> Ads » : il se reconnaît **avant**
     l'organique du même nom, sinon « LinkedIn Ads » ouvrirait l'onglet
     LinkedIn et le compte publicitaire n'aurait nulle part où aller. `ads`
     en **mot entier** : « Threads » contient la suite a-d-s. */
  const paid = /\bads\b/.test(folded) || folded.includes("publicit");
  if (folded.includes("linkedin")) return [paid ? "linkedin-ads" : "linkedin"];
  if (folded.includes("tiktok") || folded.includes("tik tok")) {
    return [paid ? "tiktok-ads" : "tiktok"];
  }
  // « Meta Ads » avant « Facebook » : les deux contiennent souvent « meta ».
  if (paid) return ["meta-ads"];
  if (folded.includes("facebook") || folded === "fb") return ["facebook"];
  if (folded.includes("youtube") || folded === "yt") return ["youtube"];
  // « X » seul ou « Twitter » — jamais un simple `includes("x")`, qui
  // attraperait n'importe quel mot.
  if (folded === "x" || folded.includes("twitter") || folded === "x (twitter)") {
    return ["x"];
  }
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
   * Déclarés au Contexte sous un nom qu'on ne sait pas reconnaître —
   * Pinterest, Threads, une newsletter. Rendus tels qu'écrits pour que
   * l'écran les nomme au lieu de rester muet.
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

  const networks = (
    [
      "meta-ads",
      "instagram",
      "facebook",
      "linkedin",
      "linkedin-ads",
      "tiktok",
      "tiktok-ads",
      "youtube",
      "x",
      "site-web",
    ] as const
  ).filter((network) => connected(network) || declared.includes(network));

  // Ordre fixe, jamais l'ordre du Contexte : les onglets doivent tomber au
  // même endroit d'un client à l'autre, sinon on cherche « Meta Ads » à une
  // place différente à chaque espace.
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
