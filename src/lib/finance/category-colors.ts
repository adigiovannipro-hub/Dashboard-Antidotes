import { slugifyCategoryName } from "./categories";

/**
 * La couleur d'une catégorie de dépense — stable, automatique, dans la charte.
 *
 * Le camembert colorait ses parts par **rang** (les trois plus grosses
 * prenaient les teintes de série) : changer de mois repeignait les
 * catégories, et « Virements » pouvait être vert en août et bleu en juillet.
 * La couleur suit désormais l'**entité** : elle se dérive du slug, une fois
 * pour toutes — c'est la règle du design system (« la couleur suit l'entité,
 * jamais son rang »), et c'est ce qui rend deux mois comparables d'un regard.
 *
 * **La gamme est celle des diagrammes du Reporting Site Web** — une rampe
 * verte mono-teinte, demandée telle quelle. Les chaleurs d'avant (doré,
 * orange brûlé, terre, ambre) sont parties : elles tenaient la place d'une
 * palette catégorielle, et deux gammes voisines sur le même écran se lisaient
 * comme deux chartes. Les sept pas vivent dans `globals.css` sous
 * `--share-1..7` — un jeton, jamais un hexadécimal, parce qu'il porte aussi
 * son inversion en mode sombre, ce qu'une valeur figée ne sait pas faire ; et
 * les trois verts d'ANMF y entrent **par `--ordinal-1/2/3`**, pas recopiés.
 *
 * Sept pas, c'est le maximum lisible : plus clair que `--share-1`, une part
 * tombe sous 2:1 sur la surface blanche et se lit comme un trou du camembert.
 * C'est aussi ce qu'il faut, les sept catégories du plan par défaut recevant
 * chacune la sienne.
 *
 * Une rampe mono-teinte ne sépare pas deux pas voisins aussi nettement qu'un
 * vert d'un orange : c'est le **liseré de surface** entre deux parts et la
 * **légende chiffrée complète**, toujours rendue à côté du camembert, qui
 * portent l'identité — jamais la couleur seule. C'était déjà vrai pour un
 * daltonien deutan, à qui la gamme chaude ne servait à rien.
 */
export const CATEGORY_PALETTE: readonly string[] = [
  "var(--share-1)", // vert clair
  "var(--share-2)", // le vert de marque — --ordinal-1
  "var(--share-3)",
  "var(--share-4)", // --ordinal-2
  "var(--share-5)",
  "var(--share-6)",
  "var(--share-7)", // le vert profond — --ordinal-3 en clair
];

/**
 * Les sept catégories du plan par défaut reçoivent leur teinte **en dur** :
 * le hachage les aurait laissées au hasard, avec des collisions probables
 * entre les sept. Les rangs sautent d'un bout à l'autre de la rampe —
 * « Restauration » et « Transports », qui se suivent souvent dans le
 * camembert, ne peuvent pas tomber sur deux pas voisins. Une catégorie
 * personnalisée passe par le hachage — déterministe, donc la même couleur à
 * chaque rendu, sur chaque écran, sans colonne en base ni migration.
 */
const FIXED_SLOTS: Record<string, number> = {
  virements: 6,
  restauration: 1,
  logiciels: 4,
  marketing: 0,
  transports: 3,
  frais: 5,
  voyages: 2,
};

/** « Autres » (repli) et « Sans catégorie » : des gris, hors gamme — ce ne
    sont pas des catégories, une teinte de charte les ferait passer pour
    telles. */
export const OTHER_COLOR = "var(--text-tertiary)";
export const UNCATEGORIZED_COLOR = "var(--border-strong, #c8c6c0)";

export function categoryColor(slugOrName: string): string {
  return CATEGORY_PALETTE[preferredSlot(slugOrName)]!;
}

/**
 * Les couleurs d'un jeu de catégories affichées **ensemble**, sans doublon.
 *
 * `categoryColor` seule ne suffit pas : le hachage d'une catégorie
 * personnalisée peut tomber sur le pas d'une autre, et c'est arrivé du
 * premier coup — « Voyage », « Autre » et « Restauration » portaient le même
 * vert sur le même camembert, vu à l'écran. Trois parts de la même couleur ne
 * se départagent plus, et la légende chiffrée ne rattrape pas ça.
 *
 * La règle : chacune demande son pas (fixe pour les sept du plan, haché
 * sinon) ; si le pas est déjà pris par une part voisine, elle prend le
 * suivant libre, en tournant. L'ordre de parcours est celui des parts, du
 * plus gros au plus petit — la plus grosse garde donc sa teinte, et c'est la
 * plus petite qui se décale.
 *
 * Conséquence assumée : la teinte d'une catégorie **personnalisée** peut
 * bouger si l'entourage change d'un mois à l'autre. Une teinte qui se décale
 * est un moindre mal devant deux parts jumelles, et les sept du plan, elles,
 * ne bougent jamais tant qu'elles sont seules à demander leur pas.
 */
export function assignCategoryColors(slugsOrNames: readonly string[]): Map<string, string> {
  const taken = new Set<number>();
  const colors = new Map<string, string>();

  for (const key of slugsOrNames) {
    if (colors.has(key)) continue;
    let slot = preferredSlot(key);
    for (let step = 0; step < CATEGORY_PALETTE.length && taken.has(slot); step += 1) {
      slot = (slot + 1) % CATEGORY_PALETTE.length;
    }
    taken.add(slot);
    colors.set(key, CATEGORY_PALETTE[slot]!);
  }

  return colors;
}

/** Le pas que demande une catégorie : en dur pour les sept du plan, haché
    sinon — déterministe, donc la même demande à chaque rendu. */
function preferredSlot(slugOrName: string): number {
  const slug = slugifyCategoryName(slugOrName);
  const fixed = FIXED_SLOTS[slug];
  if (fixed !== undefined) return fixed;
  return hashSlug(slug) % CATEGORY_PALETTE.length;
}

/** FNV-1a 32 bits — déterministe et sans dépendance ; l'aléa cryptographique
    n'a rien à faire dans une couleur. */
function hashSlug(slug: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < slug.length; i += 1) {
    hash ^= slug.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}
