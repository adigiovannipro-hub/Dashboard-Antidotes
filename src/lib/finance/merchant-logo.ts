/**
 * Le repère visuel d'un marchand, à gauche de son nom.
 *
 * **Pourquoi des initiales et pas le vrai logo.** Les trois façons d'obtenir
 * un logo de marque coûtent toutes quelque chose que ce projet a décidé de ne
 * pas payer :
 *
 *   • aller le chercher à chaque affichage (favicon Google, logo.dev) est un
 *     appel tiers depuis le navigateur — la règle « aucun fetch live vers une
 *     API tierce depuis le client » ne souffre pas d'exception, et un
 *     dashboard de comptabilité qui annonce ses marchands à un tiers à chaque
 *     ouverture est précisément ce qu'elle interdit ;
 *   • le télécharger au passage du cron et le ranger dans le Storage respecte
 *     la règle, mais c'est un sous-chantier entier — deviner le domaine,
 *     récupérer, stocker, servir, rafraîchir — pour un ornement ;
 *   • le dessiner à la main revient à approximer des marques déposées, ce qui
 *     rend moins bien que rien.
 *
 * Les initiales, elles, distinguent ce qu'on a besoin de distinguer : Grab de
 * Google, Black Sand d'Anchor. C'est ce qu'on lit dans un tableau qu'on
 * parcourt — deux lettres à la même place, ligne après ligne.
 *
 * Fonction pure, sans import : elle se teste et se lit des deux côtés.
 */

/* Mots qui ne portent aucune identité : formes juridiques, mentions de pays,
   et le préfixe « PT » des sociétés indonésiennes, omniprésent dans les
   relevés. Les écarter fait tomber « PT Unbranded Hospitality » sur « UH » et
   non « PU ». */
const NOISE = new Set([
  "pt",
  "cv",
  "sa",
  "sas",
  "sarl",
  "eurl",
  "ltd",
  "llc",
  "inc",
  "gmbh",
  "bv",
  "nv",
  "srl",
  "spa",
  "co",
  "corp",
  "the",
  "de",
  "du",
  "des",
  "la",
  "le",
  "les",
  "and",
  "et",
]);

/**
 * Une ou deux lettres tirées du nom du marchand, en capitales.
 *
 * Chaîne vide quand il n'y a rien à en tirer — l'appelant montre alors une
 * icône générique plutôt qu'un carré vide, et surtout jamais une lettre
 * inventée.
 */
export function merchantInitials(name: string | null | undefined): string {
  if (!name) return "";

  /* Le nom brut d'un relevé traîne des identifiants de terminal et des codes
     pays : « Grab* A-9MXOR7UGWAE9AV, 6281384748739, IDN ». On coupe à la
     première virgule et on écarte les fragments qui contiennent un chiffre. */
  const head = name.split(",")[0] ?? "";

  const words = head
    .replace(/[*/\\|]+/g, " ")
    .split(/[\s.\-_]+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    /* Deux lettres au minimum : un fragment d'une seule lettre vient toujours
       d'un code de terminal, jamais d'un nom — « Grab* A-9MXOR7UGWAE9AV »
       laissait un « A » qui rendait « GA » au lieu de « GR ». */
    .filter((word) => word.length >= 2 && !/\d/.test(word))
    .filter((word) => !NOISE.has(word.toLowerCase()));

  if (words.length === 0) return "";

  if (words.length === 1) {
    // Un seul mot : ses deux premières lettres. « Grab » → « GR ».
    return words[0]!.slice(0, 2).toUpperCase();
  }

  // Plusieurs mots : la première lettre des deux premiers. « Black Sand
  // Brewery » → « BS », « Google Wallet » → « GW ».
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}
