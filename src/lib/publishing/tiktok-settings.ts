/**
 * Les réglages TikTok d'une publication — ceux que TikTok exige de voir
 * **choisis par l'utilisateur** avant toute publication directe.
 *
 * Les règles de partage de la Content Posting API, que l'audit vérifie à
 * l'écran : le compte de destination est nommé ; la confidentialité se
 * choisit dans les options que TikTok rend pour ce compte, **sans valeur par
 * défaut** ; commentaires, duos et collages sont décochés tant qu'on ne les
 * coche pas, et grisés si le compte les a coupés ; le contenu commercial est
 * déclaré (« votre marque », « contenu de marque ») ; et l'accord avec la
 * « Music Usage Confirmation » est affiché avant de publier.
 *
 * Depuis le 7/10, plus aucun réglage ne se saisit à l'écran (demande de
 * l'utilisateur : le panneau était visible du client et ralentissait la
 * programmation) : une publication sans réglages enregistrés part avec
 * `DEFAULT_TIKTOK_SETTINGS` — tout le monde, commentaires, duos et collages
 * ouverts, pas de contenu commercial. Elle part en direct dès que l'app est
 * auditée, en brouillon d'ici là. Revers assumé : l'audit TikTok exige un
 * choix explicite à l'écran, il faudra remontrer un panneau pour sa vidéo.
 *
 * Module sans `server-only` : le panneau du planning s'en sert aussi.
 */

export type TiktokPrivacy =
  | "PUBLIC_TO_EVERYONE"
  | "MUTUAL_FOLLOW_FRIENDS"
  | "FOLLOWER_OF_CREATOR"
  | "SELF_ONLY";

export const TIKTOK_PRIVACY_LABELS: Record<TiktokPrivacy, string> = {
  PUBLIC_TO_EVERYONE: "Tout le monde",
  MUTUAL_FOLLOW_FRIENDS: "Amis",
  FOLLOWER_OF_CREATOR: "Abonnés",
  SELF_ONLY: "Moi uniquement",
};

export function isTiktokPrivacy(value: unknown): value is TiktokPrivacy {
  return typeof value === "string" && value in TIKTOK_PRIVACY_LABELS;
}

export type TiktokPostSettings = {
  privacy: TiktokPrivacy;
  allowComment: boolean;
  allowDuet: boolean;
  allowStitch: boolean;
  /** La publication fait la promotion de la marque du client. */
  yourBrand: boolean;
  /** Partenariat rémunéré avec une marque tierce. */
  brandedContent: boolean;
  /** Le moment où la personne a enregistré ces réglages — et donc accepté la Music Usage Confirmation. */
  consentedAt: string;
};

export const DEFAULT_TIKTOK_SETTINGS: TiktokPostSettings = {
  privacy: "PUBLIC_TO_EVERYONE",
  allowComment: true,
  allowDuet: true,
  allowStitch: true,
  yourBrand: false,
  brandedContent: false,
  consentedAt: "1970-01-01T00:00:00.000Z",
};

/**
 * Relit une colonne `jsonb` : le type dit ce que l'écran y écrit, pas ce que
 * la base contient. Une forme incomplète vaut « pas de réglages ».
 */
export function parseTiktokSettings(raw: unknown): TiktokPostSettings | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (!isTiktokPrivacy(value.privacy) || typeof value.consentedAt !== "string") return null;
  return {
    privacy: value.privacy,
    allowComment: value.allowComment === true,
    allowDuet: value.allowDuet === true,
    allowStitch: value.allowStitch === true,
    yourBrand: value.yourBrand === true,
    brandedContent: value.brandedContent === true,
    consentedAt: value.consentedAt,
  };
}

/** Ce que TikTok refuserait, dit avant l'envoi. */
export function tiktokSettingsIssue(
  settings: Pick<TiktokPostSettings, "privacy" | "brandedContent">,
): string | null {
  if (settings.brandedContent && settings.privacy === "SELF_ONLY") {
    return "un contenu de marque ne peut pas être en « Moi uniquement »";
  }
  return null;
}

/** Ce que le compte autorise, lu sur `creator_info` au moment de publier. */
export type TiktokCreator = {
  nickname: string | null;
  username: string | null;
  avatarUrl: string | null;
  privacyOptions: TiktokPrivacy[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxDurationSec: number | null;
};

export function creatorOf(payload: unknown): TiktokCreator {
  const data = (payload ?? {}) as Record<string, unknown>;
  const text = (key: string) => (typeof data[key] === "string" && data[key] ? (data[key] as string) : null);
  const options = Array.isArray(data.privacy_level_options)
    ? data.privacy_level_options.filter(isTiktokPrivacy)
    : [];
  return {
    nickname: text("creator_nickname"),
    username: text("creator_username"),
    avatarUrl: text("creator_avatar_url"),
    privacyOptions: options,
    commentDisabled: data.comment_disabled === true,
    duetDisabled: data.duet_disabled === true,
    stitchDisabled: data.stitch_disabled === true,
    maxDurationSec:
      typeof data.max_video_post_duration_sec === "number" ? data.max_video_post_duration_sec : null,
  };
}

/** Le plafond de légende de TikTok, compté en unités UTF-16 comme l'API. */
export const TIKTOK_CAPTION_MAX = 2200;

/**
 * Le `post_info` de la publication directe. Un réglage coupé par le compte
 * l'emporte sur celui de la publication : TikTok refuserait sinon.
 */
export function directPostInfo(
  settings: TiktokPostSettings,
  creator: TiktokCreator,
  caption: string,
): Record<string, unknown> {
  return {
    title: caption,
    privacy_level: settings.privacy,
    disable_comment: !settings.allowComment || creator.commentDisabled,
    disable_duet: !settings.allowDuet || creator.duetDisabled,
    disable_stitch: !settings.allowStitch || creator.stitchDisabled,
    brand_organic_toggle: settings.yourBrand,
    brand_content_toggle: settings.brandedContent,
  };
}
