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

/**
 * Les mots par lesquels Meta dit « j'ai renoncé », et non « je refuse ».
 *
 * « long polling terminated due to timeout », un 504 de passerelle, un
 * « temporarily unavailable » : ce sont des refus **de charge**, pas de droits.
 * Les reconnaître est ce qui a réparé les messages privés d'Instagram — le
 * premier appel demandait 50 fils × 25 messages avec leurs pièces jointes, Meta
 * n'assemblait pas la réponse dans son délai, et l'escalier de repli ne
 * descendait que sur « reduce the amount of data ». Un timeout partait donc
 * en avertissement muet, et zéro DM Instagram n'est jamais entré en base.
 */
const TRANSIENT_MARKERS = [
  "long polling",
  "timeout",
  "timed out",
  "gateway",
  "temporarily unavailable",
] as const;

/**
 * Les codes Graph d'un incident passager : 1 (« An unknown error occurred »),
 * 2 (« An unexpected error has occurred ») et −1 (erreur interne).
 */
const TRANSIENT_CODES = new Set([1, 2, -1]);

/**
 * Le numéro d'un refus Graph, `(#10)` → 10.
 *
 * Extrait plutôt que cherché en sous-chaîne : `"(#10)".includes("(#1)")` est
 * vrai, et confondre le refus de portée `pages_read_user_content` avec un
 * incident passager ferait redescendre l'escalier pour rien — quinze appels
 * pour le même refus.
 */
export function metaErrorCode(raw: string): number | null {
  const match = /\(#(-?\d+)\)/.exec(raw);
  return match ? Number(match[1]) : null;
}

/**
 * Vrai quand le refus vaut la peine d'être redemandé — plus petit, ou plus
 * tard. C'est le prédicat que l'escalier de volume de la messagerie consulte
 * au même titre que « reduce the amount of data » : un timeout est le symptôme
 * d'une demande trop lourde, pas une fin de non-recevoir.
 *
 * `MetaError.retryable` sans importer `MetaError` : ce module est **pur** et
 * testé, quand le transport porte `server-only`.
 */
function saysTransient(raw: string): boolean {
  const code = metaErrorCode(raw);
  if (code !== null && TRANSIENT_CODES.has(code)) return true;

  const text = raw.toLowerCase();
  return TRANSIENT_MARKERS.some((marker) => text.includes(marker));
}

export function isTransientMeta(error: unknown): boolean {
  if (
    typeof error === "object" &&
    error !== null &&
    "retryable" in error &&
    (error as { retryable?: unknown }).retryable === true
  ) {
    return true;
  }
  if (!(error instanceof Error)) return false;
  return saysTransient(error.message);
}

export function explainMetaError(raw: string): MetaDiagnosis {
  const text = raw.toLowerCase();

  if (text.includes("invalid scopes")) {
    return {
      // Le dialogue refuse une portée que l'app ne **propose** pas : elle
      // n'est pas ajoutée dans la console Meta. Rebrancher sans ce réglage
      // rejouerait le même refus.
      message:
        "Meta a refusé une portée à la connexion (« Invalid Scopes ») : elle n'est pas ajoutée à l'application dans la console Meta (Autorisations et fonctionnalités). L'y ajouter, puis relancer la connexion.",
      reconnect: false,
    };
  }

  if (text.includes("pages_read_user_content") || text.includes("(#10)")) {
    return {
      // Le jeton en base ne porte pas la permission — un branchement fait
      // avant qu'elle rejoigne les portées. En accès standard elle fonctionne
      // pour les comptes ayant un rôle dans l'app : rebrancher suffit.
      message: `Facebook refuse les publications de la Page : la permission « pages_read_user_content » manque au jeton enregistré. ${RECONNECT} Abonnés et vitrine restent synchronisés en attendant.`,
      reconnect: true,
    };
  }

  if (
    text.includes("pages_messaging") ||
    text.includes("instagram_manage_messages")
  ) {
    return {
      message: `Meta refuse la boîte de messages privés : les portées « pages_messaging » et « instagram_manage_messages » manquent au jeton. Les ajouter à l'application dans la console Meta si ce n'est pas fait, puis ${RECONNECT.charAt(0).toLowerCase()}${RECONNECT.slice(1)} Les commentaires, eux, continuent de remonter.`,
      reconnect: true,
    };
  }

  if (
    text.includes("instagram_manage_comments") ||
    text.includes("pages_manage_engagement")
  ) {
    return {
      message: `Meta refuse la lecture ou la réponse aux commentaires : les portées « instagram_manage_comments » et « pages_manage_engagement » manquent au jeton enregistré. Les ajouter à l'application dans la console Meta si ce n'est pas fait, puis ${RECONNECT.charAt(0).toLowerCase()}${RECONNECT.slice(1)}`,
      reconnect: true,
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

  if (text.includes("reduce the amount of data")) {
    return {
      /* Refus de **volume**, pas de droits : la collecte redécoupe désormais
         la fenêtre toute seule (`windows.ts`). Si le message survit à ça,
         c'est qu'une seule journée est déjà trop lourde — un compte à
         centaines de régions — et il n'y a rien sous le jour à tenter. */
      message:
        "Meta a trouvé la demande trop lourde, même découpée à la journée. Réduire la période affichée, puis relancer la synchronisation.",
      reconnect: false,
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

  if (saysTransient(raw)) {
    return {
      /* Rien à rebrancher : Meta a renoncé à assembler la réponse. Le passage
         suivant repart du palier réduit, et c'est ce découpage — pas un geste
         de l'utilisateur — qui fait passer la boîte. */
      message:
        "Meta n'a pas répondu à temps sur cette boîte. Le passage suivant redemande par tranches plus petites.",
      reconnect: false,
    };
  }

  // Inconnu : on rend le message d'origine plutôt qu'une phrase creuse — il
  // reste la seule piste, et le masquer coûterait le diagnostic.
  return { message: raw, reconnect: false };
}
