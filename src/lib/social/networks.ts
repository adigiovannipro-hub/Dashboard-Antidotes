/**
 * Le pont entre les trois listes de réseaux du projet.
 *
 * Elles existaient déjà, sans se parler, et c'est ce silence qui faisait
 * « il manque des réseaux » :
 *
 *   `NETWORK_SUGGESTIONS`   ce qu'on **doit livrer** — texte libre, Contexte
 *   `SocialAccountKind`     ce qu'on **peut brancher** — enum, comptes sociaux
 *   `PlanningPlatform`      ce qu'on **planifie** — enum, couloirs du planning
 *
 * Un client déclarait YouTube à son contrat et l'écran des connexions n'en
 * disait rien : il affichait trois lignes en dur, celles que Meta rapporte.
 * Ici, la liste déclarée au Contexte devient la liste à brancher, et la même
 * liste devient les couloirs de ses mois.
 *
 * Tout est pur : le rapprochement se rejoue sur des chaînes, sans base.
 */
import { networkKey } from "@/lib/context/types";
import type { PlanningPlatform } from "@/lib/planning/types";

import { META_KINDS, type SocialAccountKind } from "./types";

/**
 * Le compte à brancher pour un réseau déclaré au Contexte.
 *
 * « Facebook » donne `facebook_page` : côté contrat on dit le réseau, côté
 * branchement on affecte une Page — c'est la même chose vue des deux bouts.
 * Un nom inconnu ne rend rien plutôt qu'un rapprochement approximatif : une
 * newsletter déclarée aux livrables n'est pas un compte à brancher.
 */
const KIND_BY_NETWORK: Record<string, SocialAccountKind> = {
  instagram: "instagram",
  facebook: "facebook_page",
  linkedin: "linkedin",
  tiktok: "tiktok",
  "tik-tok": "tiktok",
  youtube: "youtube",
  pinterest: "pinterest",
  x: "x",
  twitter: "x",
  threads: "threads",
  snapchat: "snapchat",
};

/** Le couloir de planning d'un réseau déclaré. */
const PLATFORM_BY_NETWORK: Record<string, PlanningPlatform> = {
  instagram: "instagram",
  facebook: "facebook",
  meta: "meta",
  linkedin: "linkedin",
  tiktok: "tiktok",
  "tik-tok": "tiktok",
  youtube: "youtube",
  pinterest: "pinterest",
  x: "x",
  twitter: "x",
  snapchat: "snapchat",
};

export function kindForNetwork(name: string): SocialAccountKind | null {
  return KIND_BY_NETWORK[networkKey(name)] ?? null;
}

/**
 * Le couloir d'un réseau déclaré.
 *
 * `other` par défaut, et c'est voulu : Threads est un réseau légitime aux
 * livrables sans avoir sa valeur dans l'enum du planning. Le couloir garde
 * alors le **nom** saisi, qui est ce qu'on lit à l'écran ; seule la catégorie
 * technique retombe sur « autre ».
 */
export function platformForNetwork(name: string): PlanningPlatform {
  return PLATFORM_BY_NETWORK[networkKey(name)] ?? "other";
}

/** Une ligne de l'écran des connexions. */
export type ConnexionRow = {
  /** Ce qui s'affiche : le nom tel que le client l'a déclaré, quand il vient de là. */
  label: string;
  /** Le compte à affecter, `null` pour un livrable qui ne se branche pas. */
  kind: SocialAccountKind | null;
  /** Déclaré aux livrables du client, par opposition à ajouté ici. */
  declared: boolean;
};

/**
 * Les lignes de l'écran des connexions, dans l'ordre où on les lit.
 *
 * Trois sources, et aucune n'est facultative :
 *
 *   1. les réseaux **déclarés** au Contexte — ce que le client attend ;
 *   2. le compte publicitaire Meta, **toujours** : il n'est pas un réseau de
 *      publication, c'est lui qui alimente le Reporting, et personne ne pense
 *      à le déclarer aux livrables ;
 *   3. tout compte **déjà affecté** qui ne serait dans aucune des deux. Sans
 *      cette reprise, retirer un réseau des livrables ferait disparaître de
 *      l'écran une affectation qui, elle, continue de publier — une connexion
 *      perdue de vue est pire qu'une ligne en trop.
 */
export function planConnexionRows(options: {
  /** Les réseaux déclarés aux livrables, dans l'ordre de saisie. */
  networks: string[];
  /** Les réseaux déjà affectés à cet espace. */
  linked: SocialAccountKind[];
}): ConnexionRow[] {
  const rows: ConnexionRow[] = [];
  const seenKinds = new Set<SocialAccountKind>();
  const seenLabels = new Set<string>();

  for (const name of options.networks) {
    const label = name.trim();
    if (label.length === 0) continue;

    const kind = kindForNetwork(label);
    if (kind) {
      if (seenKinds.has(kind)) continue;
      seenKinds.add(kind);
    } else {
      // Un livrable hors réseau — « Newsletter » — n'a pas de compte : il ne
      // se dédoublonne que sur son nom.
      if (seenLabels.has(networkKey(label))) continue;
      seenLabels.add(networkKey(label));
    }

    rows.push({ label, kind, declared: true });
  }

  for (const kind of [...META_KINDS, ...options.linked]) {
    if (seenKinds.has(kind)) continue;
    // Le compte publicitaire est toujours là ; les deux autres membres de
    // `META_KINDS` ne s'ajoutent que s'ils sont réellement affectés.
    if (kind !== "meta_ad_account" && !options.linked.includes(kind)) continue;
    seenKinds.add(kind);
    rows.push({ label: "", kind, declared: false });
  }

  return rows;
}
