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
 * La gamme est celle de la charte : verts autour du vert de marque, olive,
 * doré, oranges — ni rose ni bleu, sur consigne. Validée au validateur de
 * palette sur les deux surfaces (≥ 2:1 partout, écart vision normale 19,2) ;
 * une gamme chaude resserrée ne peut par nature pas séparer vert et orange
 * pour un daltonien deutan — c'est la **légende chiffrée complète**, toujours
 * rendue à côté du camembert, qui porte l'identité, jamais la couleur seule.
 */
export const CATEGORY_PALETTE: readonly string[] = [
  "#2e5c17", // vert profond
  "#d9a520", // doré
  "#5c9139", // vert de marque foncé
  "#c15818", // orange brûlé
  "#a3b02c", // olive
  "#8a4a12", // terre
  "#e0912f", // ambre
  "#3f7a2a", // vert feuille
];

/**
 * Les sept catégories du plan par défaut reçoivent leur teinte **en dur**,
 * dispersée sur la gamme : le hachage les aurait laissées au hasard, avec
 * des collisions probables entre les sept. Une personnalisée passe par le
 * hachage — déterministe, donc la même couleur à chaque rendu, sur chaque
 * écran, sans colonne en base ni migration.
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
