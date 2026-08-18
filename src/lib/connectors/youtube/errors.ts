/**
 * Les refus de YouTube, dits en français et suivis du geste à faire.
 *
 * Google répond par une `reason` machine — `quotaExceeded`,
 * `commentsDisabled` — et un message anglais. Recopié tel quel, ça ressemble
 * à une panne du produit ; ce sont presque toujours des états normaux de la
 * plateforme, et chacun a une conduite à tenir. Pure et testée, comme
 * `connectors/meta/errors.ts`.
 */

export type YouTubeDiagnosis = {
  message: string;
  /** Vrai quand rebrancher la chaîne depuis Connexions y change quelque chose. */
  reconnect: boolean;
};

const RECONNECT = "Rebrancher YouTube depuis Connexions, sur le Planning.";

export function explainYouTubeError(raw: string): YouTubeDiagnosis {
  const text = raw.toLowerCase();

  if (text.includes("quotaexceeded") || text.includes("dailylimitexceeded")) {
    return {
      // Rien à faire, et surtout pas rebrancher : le quota repart à minuit
      // heure du Pacifique.
      message:
        "Le quota YouTube du jour est épuisé (10 000 unités). Le relevé reprendra au prochain passage, sans rien perdre.",
      reconnect: false,
    };
  }

  if (text.includes("commentsdisabled")) {
    return {
      message:
        "Les commentaires sont désactivés sur cette vidéo : il n'y a rien à relever, et ce n'est pas une erreur.",
      reconnect: false,
    };
  }

  if (
    text.includes("invalid_grant") ||
    text.includes("invalid credentials") ||
    text.includes("unauthorized")
  ) {
    return {
      /* `invalid_grant` a deux causes fréquentes : accès retiré depuis le
         compte Google, ou application restée en mode « Testing », où Google
         périme le jeton de rafraîchissement au bout de sept jours. */
      message: `L'autorisation Google n'est plus valable — accès retiré, ou application encore en mode « Testing », où le jeton expire au bout de sept jours. ${RECONNECT}`,
      reconnect: true,
    };
  }

  if (text.includes("insufficientpermissions") || text.includes("forbidden")) {
    return {
      message: `YouTube refuse l'accès : la portée « youtube.force-ssl » manque au jeton, ou le compte Google autorisé n'administre pas cette chaîne. ${RECONNECT}`,
      reconnect: true,
    };
  }

  if (text.includes("youtubesignuprequired")) {
    return {
      message:
        "Le compte Google autorisé n'a pas de chaîne YouTube. Autoriser le compte qui administre la chaîne du client.",
      reconnect: true,
    };
  }

  // Inconnu : on rend le message d'origine plutôt qu'une phrase creuse — il
  // reste la seule piste.
  return { message: raw, reconnect: false };
}
