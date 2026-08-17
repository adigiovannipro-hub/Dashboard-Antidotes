/**
 * Les refus de Meta, dits en français et suivis de ce qu'il faut faire.
 *
 * Graph répond en anglais, avec un numéro et deux liens vers sa
 * documentation. Recopié tel quel sur un écran, ça ressemble à une panne du
 * produit ; or ce sont presque toujours des refus **de configuration**, et
 * chacun a un geste précis pour le lever. Pure et testée : c'est de la
 * traduction, pas du transport.
 */

export type MetaDiagnosis = {
  /** La phrase affichée à l'écran, action comprise. */
  message: string;
  /** Vrai quand rebrancher le compte depuis Connexions suffit. */
  reconnect: boolean;
};

const RECONNECT = "Rebrancher le compte depuis Connexions, sur le Planning.";

export function explainMetaError(raw: string): MetaDiagnosis {
  const text = raw.toLowerCase();

  if (text.includes("invalid scopes")) {
    return {
      // Meta refuse la portée **au dialogue**, avant tout branchement : ce
      // n'est pas un jeton à refaire, c'est une permission que l'application
      // n'a pas le droit de demander tant qu'elle n'a pas passé l'App Review.
      message:
        "Meta a refusé une portée demandée à la connexion (« Invalid Scopes ») : l'application n'a pas encore le droit de la demander. C'est un réglage de l'app Meta, pas du compte — il n'y a rien à refaire côté Connexions.",
      reconnect: false,
    };
  }

  if (text.includes("pages_read_user_content") || text.includes("(#10)")) {
    return {
      // Une limite de la plateforme, pas une panne : rien à faire côté
      // utilisateur, et surtout pas rebrancher — ça n'y change rien.
      message:
        "Limite Meta — les publications de la Page Facebook ne sont pas lisibles sans passer l'App Review de Meta (permission réservée). Abonnés et vitrine de la Page sont bien synchronisés. Rien à faire de votre côté.",
      reconnect: false,
    };
  }

  if (
    text.includes("session has expired") ||
    text.includes("(#190)") ||
    text.includes("access token")
  ) {
    return {
      message: `Le jeton d'accès Meta n'est plus valable — il a expiré ou le mot de passe du compte a changé. ${RECONNECT}`,
      reconnect: true,
    };
  }

  if (text.includes("instagram_manage_insights") || text.includes("read_insights")) {
    return {
      message: `Meta refuse les statistiques : les portées « instagram_manage_insights » et « read_insights » manquent au jeton. ${RECONNECT}`,
      reconnect: true,
    };
  }

  if (text.includes("ads_read") || text.includes("(#200)")) {
    return {
      message: `Meta refuse l'accès au compte publicitaire : la portée « ads_read » manque, ou le compte n'est pas partagé avec l'application. ${RECONNECT}`,
      reconnect: true,
    };
  }

  if (text.includes("rate limit") || text.includes("(#4)") || text.includes("(#17)")) {
    return {
      // Rien à faire, et surtout pas rebrancher : le quota se recharge seul.
      message:
        "Meta a plafonné le nombre d'appels pour cette heure. La synchronisation reprendra au prochain passage, sans rien perdre.",
      reconnect: false,
    };
  }

  // Inconnu : on rend le message d'origine plutôt qu'une phrase creuse — il
  // reste la seule piste, et le masquer coûterait le diagnostic.
  return { message: raw, reconnect: false };
}
