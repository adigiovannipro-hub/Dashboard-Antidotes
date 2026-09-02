/**
 * Traduction des refus de la chaîne Composio → LinkedIn.
 *
 * Le message brut finit dans `data_sources.last_error`, que le Reporting
 * affiche en tête de page : il doit dire **le geste à faire**, pas recopier
 * un code d'erreur anglais. Même rôle que `meta/errors.ts`.
 *
 * On reconnaît des motifs, jamais des égalités strictes : les messages de
 * LinkedIn comme de Composio bougent d'une version à l'autre, leurs
 * mots-clés beaucoup moins. Tous ceux listés ici ont été **vus** contre le
 * vrai service.
 */

const PATTERNS: { test: RegExp; explain: string }[] = [
  {
    /* Vécu trois fois le 2 septembre 2026 : les portées d'organisation
       n'étaient pas demandées par la configuration d'authentification. Le
       geste est de rebrancher contre « linkedin-pages ». */
    test: /r_organization_admin|organization ACLs/i,
    explain:
      "Le compte LinkedIn connecté n'a pas les portées des pages entreprise. Rebrancher avec la configuration « linkedin-pages » (workflow « Composio — lien de connexion »).",
  },
  {
    // Le compte n'a pas le rôle administrateur sur cette page précise.
    test: /don't have permission|ADMINISTRATOR role|403/i,
    explain:
      "Le compte LinkedIn connecté n'est pas administrateur de cette page. Se faire ajouter comme administrateur sur la page, ou brancher le compte qui l'est.",
  },
  {
    // Jeton expiré ou révoqué côté LinkedIn.
    test: /invalid_grant|token.*(expired|revoked)|401|REVOKED_ACCESS_TOKEN/i,
    explain:
      "L'accès LinkedIn a expiré ou a été révoqué. Rebrancher le compte (workflow « Composio — lien de connexion »).",
  },
  {
    /* Constaté sur les trois formes d'intervalle documentées : la passerelle
       ne sait pas passer `timeIntervals`. C'est un défaut du connecteur ou de
       la passerelle, pas de la connexion — rebrancher n'y changerait rien. */
    test: /time intervals|QUERY_PARAM_NOT_ALLOWED|Bad request/i,
    explain:
      "LinkedIn a refusé la forme de la demande. C'est un défaut du connecteur, pas de la connexion — à signaler.",
  },
  {
    // Plafond d'appels : le seul cas où rebrancher ne sert à rien.
    test: /throttle|rate limit|quota|429/i,
    explain:
      "Le plafond d'appels LinkedIn est atteint. La collecte reprendra au prochain passage, rien à rebrancher.",
  },
  {
    // Composio n'a pas de compte LinkedIn dans le projet Platform.
    test: /no connected account|connected account not found|aucun compte/i,
    explain:
      "Aucun compte LinkedIn n'est connecté dans le projet Composio. Brancher le compte par le workflow « Composio — lien de connexion », toolkit linkedin.",
  },
  {
    // La clé Composio manque ou n'est pas la bonne.
    test: /COMPOSIO_API_KEY|api key.*(invalid|missing)/i,
    explain:
      "La clé Composio est absente ou invalide. Renseigner COMPOSIO_API_KEY (clé de projet Platform, « ak_… ») dans l'environnement.",
  },
];

/** Le message brut, traduit en geste à faire quand on le reconnaît. */
export function explainLinkedinError(message: string): string {
  const matched = PATTERNS.find((pattern) => pattern.test.test(message));
  if (!matched) return message;
  // Le brut reste entre parenthèses : la traduction guide, l'original prouve.
  return `${matched.explain} (${message})`;
}
