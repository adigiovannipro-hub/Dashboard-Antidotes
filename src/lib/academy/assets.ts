import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/**
 * Les URL d'affichage des couvertures et miniatures de l'Academy.
 *
 * Même doctrine que les logos d'espace : le bucket `academy-assets` est privé,
 * la base garde un **chemin**, et on signe au rendu — une URL signée stockée
 * serait périmée en une heure. Une seule requête pour toutes les images de
 * l'écran : le catalogue en affiche autant que de formations, la page d'une
 * formation autant que de modules.
 *
 * Deux formes cohabitent dans `cover_url` : un chemin de bucket, ou une URL
 * http(s) collée par l'owner. La seconde ne se signe pas — elle se rend telle
 * quelle, et `resolveAssetUrl` fait ce tri.
 */

const BUCKET = "academy-assets";

/** Une heure : au-delà, l'onglet laissé ouvert affiche des images mortes. */
const TTL_SECONDS = 60 * 60;

/** Une URL externe se reconnaît à son schéma, un chemin de bucket n'en a pas. */
export function isExternalAsset(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export const signAcademyAssets = cache(
  async (values: (string | null)[]): Promise<Map<string, string>> => {
    const paths = [
      ...new Set(
        values.filter(
          (value): value is string => Boolean(value) && !isExternalAsset(value!),
        ),
      ),
    ];
    if (paths.length === 0) return new Map();

    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(paths, TTL_SECONDS);

    // Une image qui ne se signe pas n'est pas une panne : la carte retombe sur
    // son dégradé, et l'écran reste lisible.
    if (error || !data) return new Map();

    const signed = new Map<string, string>();
    for (const entry of data) {
      if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
    }
    return signed;
  },
);

/**
 * L'URL à poser dans un `src`, ou `null` s'il n'y a pas d'image.
 *
 * Une URL externe passe sans détour ; un chemin de bucket est cherché parmi
 * les signatures fraîchement obtenues.
 */
export function resolveAssetUrl(
  value: string | null,
  signed: Map<string, string>,
): string | null {
  if (!value) return null;
  if (isExternalAsset(value)) return value;
  return signed.get(value) ?? null;
}
