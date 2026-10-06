/**
 * Traduction des refus de la chaîne Composio → TikTok Ads.
 *
 * Même rôle que `linkedin/errors.ts` : le message finit dans
 * `data_sources.last_error`, en tête du Reporting, et doit dire le geste à
 * faire. Motifs, jamais égalités. Seul le refus de forme (40002) a été vu
 * contre le vrai service ; les autres suivent les codes de la Marketing API
 * et se confirmeront au premier passage.
 */

const PATTERNS: { test: RegExp; explain: string }[] = [
  {
    // Jeton expiré ou révoqué côté TikTok.
    test: /\b4010[2-9]\b|access token|token.*(expired|revoked|invalid)/i,
    explain:
      "L'accès TikTok Ads a expiré ou a été révoqué. Rebrancher TikTok Ads depuis Connexions (bouton « Rebrancher TikTok Ads »).",
  },
  {
    // Le login branché n'a pas de rôle sur ce compte publicitaire.
    test: /no permission|permission denied|not authorized|\b40001\b/i,
    explain:
      "Le compte TikTok branché n'a pas accès à ce compte publicitaire. Lui donner un rôle dans le Business Center du client, puis relancer.",
  },
  {
    // Plafond d'appels : rebrancher n'y changerait rien.
    test: /too many requests|rate limit|\b40100\b|\b51021\b|429/i,
    explain:
      "Le plafond d'appels TikTok est atteint. La collecte reprendra au prochain passage, rien à rebrancher.",
  },
  {
    // Vu le 1/10/2026 : un paramètre que TikTok refuse. Défaut du connecteur.
    test: /\b40002\b/,
    explain:
      "TikTok a refusé la forme de la demande. C'est un défaut du connecteur, pas de la connexion — à signaler.",
  },
  {
    test: /COMPOSIO_API_KEY|api key.*(invalid|missing)/i,
    explain:
      "La clé Composio est absente ou invalide. Renseigner COMPOSIO_API_KEY (clé de projet Platform, « ak_… ») dans l'environnement.",
  },
];

/** Le message brut, traduit en geste à faire quand on le reconnaît. */
export function explainTiktokAdsError(message: string): string {
  const matched = PATTERNS.find((pattern) => pattern.test.test(message));
  if (!matched) return message;
  // Le brut reste entre parenthèses : la traduction guide, l'original prouve.
  return `${matched.explain} (${message})`;
}
