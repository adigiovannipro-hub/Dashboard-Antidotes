import type { MonthWithLanes, SubjectRow } from "./types";

/**
 * Le feed Instagram tel qu'il sera à la fin d'un mois donné.
 *
 * Trois règles, et elles viennent toutes du réseau :
 *
 *   • **l'ordre est antichronologique** — le dernier publié occupe le coin
 *     haut-gauche, le plus ancien finit en bas. Une grille rangée dans l'autre
 *     sens ne montre pas ce que le client verra ;
 *   • **les mois précédents comptent** — un feed ne commence pas au 1er du
 *     mois. Prévisualiser septembre, c'est voir septembre posé sur août ;
 *   • **les Stories n'y sont pas** — elles ne se rangent pas dans la grille du
 *     profil. Les Reels, si.
 *
 * Fonctions pures : la grille se rejoue dans un test, sans écran.
 */

/** Formats qui ne se rangent pas dans la grille du profil. */
const OUT_OF_GRID_FORMATS = ["story"];

/** Une case de la grille — vide quand la créa manque encore. */
export type FeedTile = {
  subject: SubjectRow;
  /** La créa mise en avant : la première du carrousel, comme sur Instagram. */
  cover: { path: string; url: string; name: string } | null;
  /** Une vidéo affiche sa première image ; le rendu doit le savoir. */
  isVideo: boolean;
};

export function isVideoPath(pathOrUrl: string): boolean {
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(pathOrUrl);
}

/** Ce qui est bon pour la grille : ni Story, ni contenu écarté. */
export function belongsToFeed(subject: SubjectRow): boolean {
  if (subject.status === "dropped") return false;
  return !OUT_OF_GRID_FORMATS.includes(subject.format);
}

/**
 * La grille jusqu'à la fin du mois choisi, la plus récente d'abord.
 *
 * `monthKey` est le premier jour du mois (`YYYY-MM-01`), comme partout
 * ailleurs dans le planning.
 */
export function buildFeed(
  months: MonthWithLanes[],
  monthKey: string,
  options: { platform?: string } = {},
): FeedTile[] {
  const platform = options.platform ?? "instagram";
  const limit = monthEnd(monthKey);

  const subjects = months
    .filter((month) => month.month <= monthKey)
    .flatMap((month) =>
      month.lanes
        // META porte Instagram et Facebook ensemble sur le board d'origine :
        // l'exclure priverait la prévisualisation de presque tout.
        .filter((lane) => lane.platform === platform || lane.platform === "meta")
        .flatMap((lane) => lane.subjects),
    )
    .filter(belongsToFeed)
    .filter(
      (subject) => subject.scheduled_on !== null && subject.scheduled_on <= limit,
    );

  return subjects
    .sort((a, b) => {
      const dates = (b.scheduled_on ?? "").localeCompare(a.scheduled_on ?? "");
      // À date égale, l'ordre du tableau tranche — et à l'envers, puisque la
      // dernière posée de la journée s'affiche en premier.
      return dates !== 0 ? dates : b.position - a.position;
    })
    .map((subject) => {
      const cover = subject.visuals[0] ?? null;
      return {
        subject,
        cover,
        isVideo: cover ? isVideoPath(cover.path) : false,
      };
    });
}

/** Dernier jour du mois, en UTC — un mois se calcule sans fuseau. */
export function monthEnd(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;
  const last = new Date(Date.UTC(year, month, 0));
  return last.toISOString().slice(0, 10);
}

/** Ce que la grille annonce en tête : combien de cases, combien sans créa. */
export function feedSummary(tiles: FeedTile[]): {
  total: number;
  missing: number;
} {
  return {
    total: tiles.length,
    missing: tiles.filter((tile) => tile.cover === null).length,
  };
}
