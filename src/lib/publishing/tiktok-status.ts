/**
 * Ce que TikTok répond sur un brouillon, traduit pour le planning.
 *
 * Un brouillon envoyé (`/v2/post/publish/inbox/video/init/`) atterrit dans la
 * boîte de l'application TikTok du compte : c'est le client — ou l'agence, si
 * elle tient le téléphone — qui l'ouvre et appuie sur « publier ». Tant qu'il
 * ne l'a pas fait, TikTok répond `SEND_TO_USER_INBOX` ; une fois posté,
 * `PUBLISH_COMPLETE`. C'est cette bascule qui fait passer la ligne du
 * planning en « Publié ».
 *
 * Fonctions pures, testées à part.
 */

export type TiktokDraftState =
  | { state: "waiting" }
  | { state: "published"; postId: string | null }
  | { state: "failed"; reason: string };

const FAIL_REASONS: Record<string, string> = {
  file_format_check_failed: "TikTok refuse le format du fichier vidéo",
  duration_check_failed: "durée hors des bornes de TikTok (3 s à 10 min)",
  frame_rate_check_failed: "cadence d'images refusée par TikTok (23 à 60 im/s)",
  picture_size_check_failed: "définition refusée par TikTok (360 px au moins de chaque côté)",
  publish_cancelled: "brouillon supprimé dans l'application TikTok",
  auth_removed: "l'accès d'Antidotes au compte TikTok a été retiré — rebrancher depuis Connexions",
  spam_risk_too_many_posts: "TikTok plafonne les publications du compte pour aujourd'hui",
  spam_risk_user_banned_from_posting: "le compte TikTok n'a plus le droit de publier",
  internal: "erreur interne de TikTok — réessayer",
};

/**
 * Un identifiant TikTok tient sur 19 chiffres : relu comme nombre JSON, il
 * perd ses derniers chiffres au-delà de 2^53 et pointerait vers une autre
 * vidéo. Un identifiant douteux ne fait pas de lien — le profil suffit.
 */
function safePostId(value: unknown): string | null {
  if (typeof value === "string" && /^\d+$/.test(value)) return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return String(value);
  return null;
}

/** L'état d'un brouillon, lu dans la réponse de `/v2/post/publish/status/fetch/`. */
export function draftStateOf(payload: unknown): TiktokDraftState {
  const data = (payload ?? {}) as {
    status?: string;
    fail_reason?: string;
    publicaly_available_post_id?: unknown[];
  };
  if (data.status === "PUBLISH_COMPLETE") {
    return { state: "published", postId: safePostId(data.publicaly_available_post_id?.[0]) };
  }
  if (data.status === "FAILED") {
    const reason = data.fail_reason ?? "";
    return { state: "failed", reason: FAIL_REASONS[reason] ?? `TikTok a refusé le brouillon (${reason || "sans motif"})` };
  }
  return { state: "waiting" };
}

const ERROR_CODES: Record<string, string> = {
  scope_not_authorized:
    "le compte TikTok n'a pas autorisé l'envoi de brouillons (portée video.upload) — l'ajouter à l'app TikTok et rebrancher",
  access_token_invalid: "jeton TikTok expiré — rebrancher le compte depuis Connexions",
  spam_risk_too_many_pending_share:
    "trop de brouillons en attente dans l'application TikTok — en publier ou en supprimer",
  rate_limit_exceeded: "TikTok limite les appels — réessai au passage suivant",
  url_ownership_unverified: "domaine de la vidéo non vérifié chez TikTok",
};

/** Le refus de TikTok en français, avec le geste à faire quand il existe. */
export function tiktokErrorText(code: string | undefined, message: string | undefined): string {
  if (code && ERROR_CODES[code]) return ERROR_CODES[code];
  return `TikTok ${code ?? "erreur"}${message ? ` — ${message}` : ""}`;
}
