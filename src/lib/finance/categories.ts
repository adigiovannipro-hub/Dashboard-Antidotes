/**
 * Résolution de la catégorie d'une dépense vers le plan de catégories
 * d'Antidotes.
 *
 * Airwallex n'envoie **aucune catégorie** dans ses payloads — établi sur le
 * brut réel du 7 août, dépenses fraîches et réglées confondues. Le seul
 * matériau fiable est donc le nom du marchand. Trois étages, dans cet ordre :
 *
 *   1. les règles de correspondance (`finance_category_rules`), éditées depuis
 *      l'écran — c'est la volonté explicite, elle prime toujours. Une règle
 *      s'applique si son motif égale le libellé brut, ou s'il apparaît dans le
 *      nom du marchand ;
 *   2. l'égalité de nom entre libellé brut et catégorie du plan ;
 *   3. les correspondances embarquées marchand → catégorie ci-dessous — le
 *      rangement automatique par défaut, que les règles peuvent contredire.
 *
 * Aucune correspondance : `null`. La ligne reste « sans catégorie » — mieux
 * vaut une case vide qu'un rangement inventé.
 */

import type { FinanceCategory, FinanceCategoryRule } from "./types";

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Ce qu'une dépense offre pour se faire ranger. */
export type CategorySource = {
  category_raw: string | null;
  merchant: string | null;
};

/**
 * Le plan de catégories par défaut, créé chez l'organisation s'il n'existe
 * pas. Les slugs sont l'identité stable — les noms se renomment sans casser
 * les correspondances.
 */
export const DEFAULT_CATEGORIES: readonly { slug: string; name: string }[] = [
  { slug: "restauration", name: "Restauration" },
  { slug: "transports", name: "Transports" },
  { slug: "logiciels", name: "Logiciels & abonnements" },
  { slug: "marketing", name: "Marketing & publicité" },
  { slug: "voyages", name: "Voyages & hébergement" },
  { slug: "virements", name: "Virements" },
  { slug: "frais", name: "Frais bancaires" },
];

/**
 * Les mouvements du grand livre se rangent sur leur **type**, pas sur un mot
 * du marchand : l'égalité exacte évite les collisions qu'une recherche par
 * fragment provoquerait — « fee » se trouve dans « Border Coffee ».
 */
const LEDGER_TYPE_CATEGORIES: Record<string, string> = {
  payout: "virements",
  transfer: "virements",
  conversion: "virements",
  fee: "frais",
};

/**
 * Marchand → slug de catégorie, premier motif trouvé gagnant — « google ads »
 * doit donc précéder « google ». Grab est en restauration sur consigne
 * explicite : c'est l'usage réel du compte, pas une taxonomie théorique.
 */
const MERCHANT_CATEGORY_HINTS: readonly [string, string][] = [
  ["grab", "restauration"],
  ["starbucks", "restauration"],
  ["coffee", "restauration"],
  ["cafe", "restauration"],
  ["eatery", "restauration"],
  ["restaurant", "restauration"],
  ["warung", "restauration"],
  ["bakery", "restauration"],
  ["bar ", "restauration"],
  ["mcdonald", "restauration"],
  ["burger", "restauration"],
  ["pizza", "restauration"],
  ["gojek", "transports"],
  ["uber", "transports"],
  ["bolt", "transports"],
  ["taxi", "transports"],
  ["sncf", "transports"],
  ["google ads", "marketing"],
  ["meta ", "marketing"],
  ["facebook", "marketing"],
  ["instagram", "marketing"],
  ["tiktok", "marketing"],
  ["linkedin", "marketing"],
  ["google play", "logiciels"],
  ["google", "logiciels"],
  ["apple", "logiciels"],
  ["notion", "logiciels"],
  ["figma", "logiciels"],
  ["adobe", "logiciels"],
  ["canva", "logiciels"],
  ["openai", "logiciels"],
  ["anthropic", "logiciels"],
  ["vercel", "logiciels"],
  ["supabase", "logiciels"],
  ["github", "logiciels"],
  ["spotify", "logiciels"],
  ["netflix", "logiciels"],
  ["dropbox", "logiciels"],
  ["microsoft", "logiciels"],
  ["slack", "logiciels"],
  ["airbnb", "voyages"],
  ["booking", "voyages"],
  ["agoda", "voyages"],
  ["hotel", "voyages"],
  ["hostel", "voyages"],
  ["airline", "voyages"],
  ["airasia", "voyages"],
  ["garuda", "voyages"],
  ["airwallex", "frais"],
];

/**
 * Le slug d'une catégorie personnalisée, dérivé de son nom.
 *
 * Même normalisation que la résolution — minuscules, accents à plat — plus le
 * passage en kebab-case, parce que le slug est l'identité stable : « Salaires »
 * et « salaires  » doivent désigner la même catégorie, jamais deux.
 */
export function slugifyCategoryName(name: string): string {
  return normalize(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function resolveCategory(
  source: CategorySource,
  rules: readonly FinanceCategoryRule[],
  categories: readonly FinanceCategory[],
): FinanceCategory | null {
  const rawNeedle = source.category_raw ? normalize(source.category_raw) : "";
  const merchantNeedle = source.merchant ? normalize(source.merchant) : "";

  const rule = rules.find((candidate) => {
    const matcher = normalize(candidate.matcher);
    if (matcher === "") return false;
    if (rawNeedle !== "" && matcher === rawNeedle) return true;
    return merchantNeedle !== "" && merchantNeedle.includes(matcher);
  });
  if (rule) {
    return categories.find((category) => category.id === rule.category_id) ?? null;
  }

  if (rawNeedle !== "") {
    const named = categories.find(
      (category) => normalize(category.name) === rawNeedle,
    );
    if (named) return named;

    const ledgerSlug = LEDGER_TYPE_CATEGORIES[rawNeedle];
    if (ledgerSlug) {
      const bySlug = categories.find((category) => category.slug === ledgerSlug);
      if (bySlug) return bySlug;
    }
  }

  if (merchantNeedle !== "") {
    const hint = MERCHANT_CATEGORY_HINTS.find(([keyword]) =>
      merchantNeedle.includes(keyword),
    );
    if (hint) {
      const bySlug = categories.find((category) => category.slug === hint[1]);
      if (bySlug) return bySlug;
    }
  }

  return null;
}
