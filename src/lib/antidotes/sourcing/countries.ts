/**
 * Les pays qu'une campagne de sourcing peut viser.
 *
 * Une liste courte et fermée, plutôt qu'un champ libre à codes ISO : « FR,
 * BE » se tape sans repère et se relit mal. Les codes stockés en base restent
 * les alpha-2 ; seule la saisie change. La liste ne prétend pas à
 * l'exhaustivité — un code historique absent d'ici n'est jamais perdu, le
 * formulaire le garde coché sous son code et `countryName` le rend tel quel.
 *
 * Module pur, testé.
 */

export type Country = { code: string; name: string };

/**
 * Les pays francophones ouvrent la liste, du plus proche au plus lointain —
 * c'est là que l'agence prospecte —, puis les autres en ordre alphabétique.
 */
const FRANCOPHONE: Country[] = [
  { code: "FR", name: "France" },
  { code: "BE", name: "Belgique" },
  { code: "CH", name: "Suisse" },
  { code: "LU", name: "Luxembourg" },
  { code: "MC", name: "Monaco" },
  { code: "CA", name: "Canada" },
  { code: "MA", name: "Maroc" },
  { code: "TN", name: "Tunisie" },
  { code: "DZ", name: "Algérie" },
  { code: "SN", name: "Sénégal" },
  { code: "CI", name: "Côte d'Ivoire" },
];

const OTHERS: Country[] = [
  { code: "DE", name: "Allemagne" },
  { code: "AT", name: "Autriche" },
  { code: "ES", name: "Espagne" },
  { code: "US", name: "États-Unis" },
  { code: "IE", name: "Irlande" },
  { code: "IT", name: "Italie" },
  { code: "NL", name: "Pays-Bas" },
  { code: "PT", name: "Portugal" },
  { code: "GB", name: "Royaume-Uni" },
].sort((left, right) => left.name.localeCompare(right.name, "fr"));

export const COUNTRIES: readonly Country[] = [...FRANCOPHONE, ...OTHERS];

/** Le nom français d'un code, ou le code lui-même quand la liste ne le connaît pas. */
export function countryName(code: string): string {
  const key = code.trim().toUpperCase();
  return COUNTRIES.find((country) => country.code === key)?.name ?? key;
}

export function isKnownCountry(code: string): boolean {
  const key = code.trim().toUpperCase();
  return COUNTRIES.some((country) => country.code === key);
}
