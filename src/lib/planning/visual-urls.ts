import "server-only";

import { unstable_cache } from "next/cache";

import { createAdminClient } from "@/lib/supabase/server";
import { VISUALS_BUCKET, previewPathFor } from "./storage";

/**
 * URL signées **stables** pour les visuels du Planning.
 *
 * Le jeton d'une URL signée Supabase porte un `iat` : deux signatures du même
 * chemin, même à expiration identique, donnent deux URL différentes. Signer à
 * chaque rendu — ce que faisait `resolveVisuals` — rendait donc le cache du
 * navigateur inutilisable : chaque visite de la page re-téléchargeait tous
 * les visuels, miniatures comprises. C'est ce qui faisait « plusieurs minutes
 * à chaque fois ».
 *
 * La signature passe par le Data Cache de Next, par chemin : la même URL est
 * resservie à tous les rendus (et toutes les instances) pendant sept jours,
 * signée pour quatorze — une URL servie garde toujours au moins une semaine
 * de validité, et le navigateur peut enfin mettre les octets en cache.
 *
 * Client admin et non client de session : la **garde d'accès reste la RLS**,
 * qui a filtré les publications — donc les chemins — avant d'arriver ici. La
 * signature n'est pas une porte : elle transforme un chemin déjà autorisé en
 * URL, et un cache partagé ne peut pas dépendre d'une session.
 */

const SIGNED_URL_TTL_SECONDS = 14 * 24 * 3600;
const SIGNED_URL_REVALIDATE_SECONDS = 7 * 24 * 3600;

export type SignedVisualUrls = {
  url: string;
  previewUrl: string | null;
};

export const signedVisualUrls = unstable_cache(
  async (path: string): Promise<SignedVisualUrls> => {
    const admin = createAdminClient();
    const candidates = [path, previewPathFor(path)];
    const { data } = await admin.storage
      .from(VISUALS_BUCKET)
      .createSignedUrls(candidates, SIGNED_URL_TTL_SECONDS);

    const byPath = new Map<string, string>();
    for (const entry of data ?? []) {
      if (entry.signedUrl && entry.path) byPath.set(entry.path, entry.signedUrl);
    }
    return {
      url: byPath.get(path) ?? "",
      previewUrl: byPath.get(previewPathFor(path)) ?? null,
    };
  },
  ["visuel-signe"],
  { revalidate: SIGNED_URL_REVALIDATE_SECONDS },
);
