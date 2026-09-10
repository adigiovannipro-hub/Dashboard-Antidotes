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
 * **Les verts sont ceux de la rampe ordinale du Reporting** — les jetons
 * `--ordinal-1/2/3` de l'histogramme des sources de trafic — et non des
 * hexadécimaux à eux : deux gammes de verts voisines mais distinctes se
 * lisaient comme un défaut d'impression d'un écran à l'autre. Le jeton fait
 * foi, il porte aussi son inversion en mode sombre, ce qu'un hexadécimal
 * figé ne sait pas faire. Un jeton passe partout où ces valeurs sont
 * consommées : `style={{ backgroundColor }}` pour la pastille de la légende
 * et l'attribut `stroke` du camembert, que le navigateur résout comme une
 * propriété CSS (c'est déjà le cas d'`OTHER_COLOR` ci-dessous).
 *
 * Les chaleurs restent en dur : aucun jeton ne les porte, et la charte n'en
 * déclare pas — les ajouter demanderait de toucher `globals.css`. Ni rose ni
 * bleu, sur consigne. L'olive d'avant est partie : entre le vert de marque et
 * le doré, elle ne séparait plus rien une fois les verts calés sur la rampe.
 *
 * Validée au validateur de palette sur les deux surfaces (≥ 2:1 partout) ;
 * une gamme chaude resserrée ne peut par nature pas séparer vert et orange
 * pour un daltonien deutan — c'est la **légende chiffrée complète**, toujours
 * rendue à côté du camembert, qui porte l'identité, jamais la couleur seule.
 */
export const CATEGORY_PALETTE: readonly string[] = [
  "var(--ordinal-1)", // vert de marque
  "#d9a520", // doré
  "var(--ordinal-3)", // vert profond
  "#c15818", // orange brûlé
  "var(--ordinal-2)", // vert médian
  "#8a4a12", // terre
  "#e0912f", // ambre
];

/**
 * Les sept catégories du plan par défaut reçoivent leur teinte **en dur**,
 * dispersée sur la gamme : le hachage les aurait laissées au hasard, avec
 * des collisions probables entre les sept. Les rangs alternent vert et
 * chaleur — deux parts voisines du camembert ne peuvent pas tomber sur deux
 * pas de la même rampe. Une personnalisée passe par le hachage —
 * déterministe, donc la même couleur à chaque rendu, sur chaque écran, sans
 * colonne en base ni migration.
 */
const FIXED_SLOTS: Record<string, number> = {
  virements: 0,
  restauration: 1,
  logiciels: 2,
  marketing: 3,
  transports: 4,
  frais: 5,
  voyages: 6,
};

/** « Autres » (repli) et « Sans catégorie » : des gris, hors gamme — ce ne
    sont pas des catégories, une teinte de charte les ferait passer pour
    telles. */
export const OTHER_COLOR = "var(--text-tertiary)";
export const UNCATEGORIZED_COLOR = "var(--border-strong, #c8c6c0)";

export function categoryColor(slugOrName: string): string {
  const slug = slugifyCategoryName(slugOrName);
  const fixed = FIXED_SLOTS[slug];
  if (fixed !== undefined) return CATEGORY_PALETTE[fixed]!;
  return CATEGORY_PALETTE[hashSlug(slug) % CATEGORY_PALETTE.length]!;
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
