/**
 * Traduction des refus de la chaîne Composio → Google Analytics.
 *
 * Le message brut finit dans `data_sources.last_error`, que l'écran du
 * Reporting affiche en tête de page : il doit dire **le geste à faire**, pas
 * recopier un code d'erreur anglais. Même rôle que `meta/errors.ts`.
 *
 * On reconnaît des motifs, jamais des égalités strictes : les messages de
 * Google comme de Composio bougent d'une version à l'autre, leurs mots-clés
 * beaucoup moins.
 */

const PATTERNS: { test: RegExp; explain: string }[] = [
  {
    // Aucun compte connecté chez Composio pour ce toolkit.
    test: /no connected account|connected account not found|could not find a connection/i,
    explain:
      "Aucun compte Google Analytics n'est connecté chez Composio. Brancher le compte Google depuis le tableau de bord Composio (voir docs/web-analytics-setup.md), puis relancer.",
  },
  {
    // Le compte Google connecté n'a pas accès à la propriété demandée.
    test: /PERMISSION_DENIED|does not have sufficient permissions|403/i,
    explain:
      "Le compte Google connecté n'a pas accès à cette propriété Analytics. Vérifier que la propriété est bien partagée avec lui, ou reconnecter le bon compte.",
  },
  {
    // Jeton expiré ou révoqué côté Google.
    test: /UNAUTHENTICATED|invalid_grant|token.*(expired|revoked)/i,
    explain:
      "L'accès Google a expiré ou a été révoqué. Reconnecter le compte Google Analytics depuis le tableau de bord Composio.",
  },
  {
    // Quota de l'API Analytics Data épuisé — rebrancher ne sert à rien.
    test: /RESOURCE_EXHAUSTED|quota|rate limit|429/i,
    explain:
      "Le quota d'appels Google Analytics est épuisé pour aujourd'hui. La collecte reprendra au prochain passage, rien à rebrancher.",
  },
  {
    // Demande mal formée : dimension et métrique incompatibles, champ inconnu.
    test: /INVALID_ARGUMENT/i,
    explain:
      "Google Analytics a refusé la forme de la demande (champs incompatibles). C'est un défaut du connecteur, pas de la connexion — à signaler.",
  },
  {
    // La clé Composio manque ou n'est pas la bonne.
    test: /COMPOSIO_API_KEY|api key.*(invalid|missing)|401/i,
    explain:
      "La clé Composio est absente ou invalide. Renseigner COMPOSIO_API_KEY (clé de projet Platform, « ak_… ») dans l'environnement.",
  },
];

/** Le message brut, traduit en geste à faire quand on le reconnaît. */
export function explainGaError(message: string): string {
  const matched = PATTERNS.find((pattern) => pattern.test.test(message));
  if (!matched) return message;
  // Le brut reste entre parenthèses : la traduction guide, l'original prouve.
  return `${matched.explain} (${message})`;
}
