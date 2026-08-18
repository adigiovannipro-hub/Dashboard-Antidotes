import "server-only";

import { decryptSecret, encryptSecret } from "@/lib/moderation/crypto";
import { refreshAccessToken, type GoogleTokens } from "@/lib/social/youtube";

/**
 * Le jeton Google d'un compte YouTube, gardé frais.
 *
 * Meta rend un jeton qui vit deux mois ; Google en rend un qui vit une heure,
 * plus un jeton de rafraîchissement permanent. Le blob chiffré porte donc un
 * **JSON** et non une chaîne — et c'est ce qui distingue les deux formats à
 * la lecture.
 */

export type StoredGoogleTokens = {
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
};

export function serializeTokens(tokens: GoogleTokens): string {
  return encryptSecret(
    JSON.stringify({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: tokens.expiresAt,
    } satisfies StoredGoogleTokens),
  );
}

function parseTokens(blob: string): StoredGoogleTokens {
  const clear = decryptSecret(blob);
  try {
    return JSON.parse(clear) as StoredGoogleTokens;
  } catch {
    throw new Error(
      "Le jeton enregistré n'est pas au format Google — rebrancher YouTube depuis Connexions.",
    );
  }
}

/**
 * Un jeton d'accès utilisable, rafraîchi si besoin.
 *
 * Rend aussi le blob à réécrire quand le rafraîchissement a eu lieu : c'est
 * l'appelant qui a le client base sous la main, et lui seul sait s'il a le
 * droit d'écrire.
 */
export async function usableAccessToken(blob: string): Promise<{
  accessToken: string;
  refreshed: string | null;
}> {
  const stored = parseTokens(blob);

  // Encore valable : rien à redemander.
  if (Date.parse(stored.expires_at) > Date.now()) {
    return { accessToken: stored.access_token, refreshed: null };
  }

  if (!stored.refresh_token) {
    throw new Error(
      "Le jeton YouTube a expiré et aucun jeton de rafraîchissement n'a été enregistré — rebrancher le compte depuis Connexions.",
    );
  }

  const tokens = await refreshAccessToken(stored.refresh_token);
  return { accessToken: tokens.accessToken, refreshed: serializeTokens(tokens) };
}
