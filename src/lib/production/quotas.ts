/**
 * Ce qu'il reste à produire pour le mois cible — fonctions pures, zéro import
 * Supabase.
 *
 * Le Contexte déclare un volume mensuel par réseau et par catégorie (« 4 Post
 * fixe, 8 Stories sur Instagram »). Le planning du mois cible contient déjà,
 * le plus souvent, quelques lignes posées à la main. La génération d'intentions
 * doit combler l'écart, pas repartir de zéro : si le contrat dit 9 et que 3
 * lignes existent, elle en produit 6.
 *
 * Le rapprochement se fait sur deux vocabulaires qui ne sont pas les mêmes :
 * la catégorie du contrat est du texte libre — chaque contrat a ses mots — et
 * le format du planning est un enum. On normalise les deux et on rapproche ce
 * qui se rapproche ; ce qui ne se rapproche pas est **dit**, jamais deviné.
 */

import {
  FORMAT_LABELS,
  PLATFORM_LABELS,
  type PlanningFormat,
  type PlanningPlatform,
} from "@/lib/planning/types";
import type {
  ContextDeliverableLine,
  ContextDeliverables,
} from "@/lib/context/types";

/** Une publication déjà présente dans le planning du mois cible. */
export type ExistingPublication = {
  platform: PlanningPlatform | null;
  format: PlanningFormat;
  name: string;
  scheduledOn: string | null;
  status: string;
};

export type QuotaLine = {
  categorie: string;
  /** `null` quand la catégorie du contrat ne correspond à aucun format. */
  format: PlanningFormat | null;
  du: number;
  deja: number;
  reste: number;
};

export type NetworkQuota = {
  reseau: string;
  /** `null` quand le nom du contrat ne correspond à aucune plateforme connue. */
  platform: PlanningPlatform | null;
  lignes: QuotaLine[];
  /** Publications déjà là dont le format ne tombe dans aucune ligne du contrat. */
  horsQuota: number;
  duTotal: number;
  dejaTotal: number;
  resteTotal: number;
};

export type QuotaReport = {
  reseaux: NetworkQuota[];
  /** Lignes du contrat rattachées à aucun réseau. */
  horsReseau: QuotaLine[];
  /** Publications déjà là sur un réseau absent du contrat. */
  reseauxNonContractuels: { platform: PlanningPlatform | null; deja: number }[];
  duTotal: number;
  dejaTotal: number;
  resteTotal: number;
};

// --- Rapprochement des vocabulaires -------------------------------------------

/** Minuscules, sans accents ni ponctuation, sans pluriel simple. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/s$/, "");
}

/**
 * Les mots par lesquels un contrat désigne un format du planning.
 *
 * Liste volontairement courte : mieux vaut une catégorie non rapprochée, qui
 * se voit dans le rapport, qu'un rapprochement approximatif qui fausse un
 * compte sans rien dire.
 */
const FORMAT_ALIASES: Record<PlanningFormat, string[]> = {
  post: ["post", "postfixe", "publication", "postsimple", "imagefixe", "fixe"],
  story: ["story", "storie", "stories"],
  reel: ["reel", "reels", "short"],
  carousel: ["carrousel", "carousel"],
  video: ["video", "videolongue"],
  thread: ["thread"],
  dark: ["dark", "darkpost"],
  other: ["autre"],
};

/** Le format du planning que désigne une catégorie de contrat, si reconnu. */
export function formatForCategory(categorie: string): PlanningFormat | null {
  const key = normalize(categorie);
  if (key === "") return null;
  for (const [format, aliases] of Object.entries(FORMAT_ALIASES)) {
    if (aliases.some((alias) => normalize(alias) === key)) {
      return format as PlanningFormat;
    }
  }
  return null;
}

/** La plateforme du planning que désigne un nom de réseau du contrat. */
export function platformForNetwork(nom: string): PlanningPlatform | null {
  const key = normalize(nom);
  if (key === "") return null;
  for (const [platform, label] of Object.entries(PLATFORM_LABELS)) {
    if (normalize(label) === key) return platform as PlanningPlatform;
  }
  return null;
}

/**
 * Les plateformes du planning qu'un réseau du contrat peut légitimement
 * couvrir, au-delà de son nom exact.
 *
 * Le board d'origine range Instagram et Facebook sous un seul réseau META.
 * Un contrat qui dit « Instagram » parle donc aussi des lignes posées sous
 * META, et réciproquement. Ces équivalences ne servent qu'en second passage :
 * un réseau nommé exactement garde la priorité sur le parapluie.
 */
function umbrellaFor(platform: PlanningPlatform | null): PlanningPlatform[] {
  switch (platform) {
    case "instagram":
    case "facebook":
      return ["meta"];
    case "meta":
      return ["instagram", "facebook"];
    default:
      return [];
  }
}

// --- Calcul --------------------------------------------------------------------

function lineFor(
  line: ContextDeliverableLine,
  existingByFormat: Map<PlanningFormat, number>,
): QuotaLine {
  const format = formatForCategory(line.categorie);
  // Une catégorie non rapprochée n'a rien à consommer : on ne lui impute pas
  // des publications au hasard, on la laisse entièrement à produire.
  const deja = format ? (existingByFormat.get(format) ?? 0) : 0;
  if (format) existingByFormat.set(format, Math.max(deja - line.quantite, 0));
  const consomme = Math.min(deja, line.quantite);
  return {
    categorie: line.categorie,
    format,
    du: line.quantite,
    deja: consomme,
    reste: Math.max(line.quantite - consomme, 0),
  };
}

/**
 * L'écart entre ce qui est dû et ce qui est déjà posé, réseau par réseau.
 *
 * Les publications déjà là sont attribuées à leur réseau puis à leur format ;
 * ce qui ne trouve pas de ligne correspondante est compté à part plutôt que
 * fondu dans un total, pour que le prompt sache qu'il existe.
 */
export function computeQuotas(
  deliverables: ContextDeliverables,
  existing: ExistingPublication[],
): QuotaReport {
  const attributed = new Set<ExistingPublication>();
  const platforms = deliverables.reseaux.map((network) =>
    platformForNetwork(network.nom),
  );

  // Deux passages, et c'est ce qui évite qu'un contrat déclarant Instagram
  // *et* Facebook laisse le premier rafler toutes les lignes rangées sous
  // META : le nom exact sert d'abord, le parapluie ne ramasse que le reste.
  const claimed: ExistingPublication[][] = deliverables.reseaux.map(() => []);
  const claim = (index: number, accepted: PlanningPlatform[]) => {
    if (accepted.length === 0) return;
    for (const item of existing) {
      if (attributed.has(item) || item.platform === null) continue;
      if (!accepted.includes(item.platform)) continue;
      attributed.add(item);
      claimed[index]!.push(item);
    }
  };
  platforms.forEach((platform, index) => claim(index, platform ? [platform] : []));
  platforms.forEach((platform, index) => claim(index, umbrellaFor(platform)));

  const reseaux: NetworkQuota[] = [];
  for (const [index, network] of deliverables.reseaux.entries()) {
    const platform = platforms[index]!;
    const mine = claimed[index]!;

    const byFormat = new Map<PlanningFormat, number>();
    for (const item of mine) {
      byFormat.set(item.format, (byFormat.get(item.format) ?? 0) + 1);
    }

    const lignes = network.publications.map((line) => lineFor(line, byFormat));
    // Ce qui reste dans la carte après consommation n'entre dans aucune ligne.
    const horsQuota = [...byFormat.values()].reduce((total, count) => total + count, 0);

    reseaux.push({
      reseau: network.nom,
      platform,
      lignes,
      horsQuota,
      duTotal: lignes.reduce((total, line) => total + line.du, 0),
      dejaTotal: lignes.reduce((total, line) => total + line.deja, 0),
      resteTotal: lignes.reduce((total, line) => total + line.reste, 0),
    });
  }

  // Les lignes hors réseau ne consomment rien : on ne sait pas où les chercher.
  const horsReseau = deliverables.publications.map((line) => ({
    categorie: line.categorie,
    format: formatForCategory(line.categorie),
    du: line.quantite,
    deja: 0,
    reste: line.quantite,
  }));

  const orphelines = existing.filter((item) => !attributed.has(item));
  const parPlateforme = new Map<PlanningPlatform | null, number>();
  for (const item of orphelines) {
    parPlateforme.set(item.platform, (parPlateforme.get(item.platform) ?? 0) + 1);
  }

  const duTotal =
    reseaux.reduce((total, network) => total + network.duTotal, 0) +
    horsReseau.reduce((total, line) => total + line.du, 0);
  const dejaTotal = reseaux.reduce((total, network) => total + network.dejaTotal, 0);

  return {
    reseaux,
    horsReseau,
    reseauxNonContractuels: [...parPlateforme.entries()].map(([platform, deja]) => ({
      platform,
      deja,
    })),
    duTotal,
    dejaTotal,
    resteTotal:
      reseaux.reduce((total, network) => total + network.resteTotal, 0) +
      horsReseau.reduce((total, line) => total + line.reste, 0),
  };
}

// --- Rendu pour les prompts ------------------------------------------------------

function platformLabel(platform: PlanningPlatform | null): string {
  return platform ? PLATFORM_LABELS[platform] : "AUTRE";
}

/**
 * Le tableau de ce qui reste, tel que le prompt d'intentions le reçoit.
 *
 * Chaîne vide quand le contrat ne déclare aucun volume : le prompt affiche
 * alors « Non renseigné. » et le modèle sait qu'il doit se caler sur
 * l'historique, pas sur un chiffre qu'on lui aurait inventé.
 */
export function renderQuotas(report: QuotaReport): string {
  if (report.duTotal === 0) return "";

  const blocs: string[] = [];

  for (const network of report.reseaux) {
    if (network.lignes.length === 0) {
      blocs.push(`- ${network.reseau} : au contrat, aucune quantité déclarée.`);
      continue;
    }
    const detail = network.lignes
      .map(
        (line) =>
          `  · ${line.categorie} : ${line.du} dus, ${line.deja} déjà au planning, ${line.reste} à créer${
            line.format === null
              ? " (catégorie non rapprochée d'un format du planning : rien ne lui a été imputé)"
              : ""
          }`,
      )
      .join("\n");
    const entete =
      network.platform === null
        ? `- ${network.reseau} (réseau inconnu du planning : aucune ligne existante ne lui a été imputée)`
        : `- ${network.reseau}`;
    const horsQuota =
      network.horsQuota > 0
        ? `\n  · ${network.horsQuota} publication${network.horsQuota > 1 ? "s" : ""} déjà au planning hors des catégories ci-dessus : en tenir compte dans l'équilibre, sans les décompter.`
        : "";
    blocs.push(
      `${entete} : ${network.resteTotal} à créer sur ${network.duTotal} dus.\n${detail}${horsQuota}`,
    );
  }

  for (const line of report.horsReseau) {
    blocs.push(
      `- Hors réseau · ${line.categorie} : ${line.du} dus, à créer (aucun réseau déclaré, donc rien de déjà posé ne leur est imputé).`,
    );
  }

  for (const orphelin of report.reseauxNonContractuels) {
    blocs.push(
      `- ${platformLabel(orphelin.platform)} : ${orphelin.deja} publication${orphelin.deja > 1 ? "s" : ""} déjà au planning sur un réseau absent du contrat. Ne pas en ajouter.`,
    );
  }

  return `${blocs.join("\n")}\n\nTOTAL À CRÉER : ${report.resteTotal} publication${report.resteTotal > 1 ? "s" : ""} (${report.duTotal} dues au contrat, ${report.dejaTotal} déjà au planning).`;
}

/** Les lignes déjà posées, telles que le prompt d'intentions les reçoit. */
export function renderExisting(existing: ExistingPublication[]): string {
  if (existing.length === 0) return "";
  return existing
    .slice()
    .sort((a, b) => (a.scheduledOn ?? "9999").localeCompare(b.scheduledOn ?? "9999"))
    .map(
      (item) =>
        `- ${item.scheduledOn ?? "sans date"} · ${platformLabel(item.platform)} · ${FORMAT_LABELS[item.format]} · « ${item.name} »`,
    )
    .join("\n");
}
