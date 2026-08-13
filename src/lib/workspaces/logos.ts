import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/**
 * Les URL d'affichage des logos d'espace.
 *
 * Le bucket est privé : `workspaces.logo_url` garde un chemin, jamais une URL
 * — celle-ci expire, et une base pleine d'URL périmées ne sert à rien. On
 * signe donc au rendu, en une seule requête pour tous les espaces à la fois :
 * le rail se rend sur chaque page, un aller-retour par client se paierait à
 * chaque navigation.
 *
 * Mis en cache par `React.cache` : le rail, l'accueil et l'en-tête d'un espace
 * appellent le même helper pendant la même requête sans le multiplier.
 */

const BUCKET = "workspace-logos";

/** Une heure : au-delà, l'onglet laissé ouvert affiche des images mortes. */
const TTL_SECONDS = 60 * 60;

export const signLogoUrls = cache(
  async (paths: (string | null)[]): Promise<Map<string, string>> => {
    const wanted = [...new Set(paths.filter((path): path is string => Boolean(path)))];
    if (wanted.length === 0) return new Map();

    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(wanted, TTL_SECONDS);

    // Un logo qui ne se signe pas n'est pas une panne : la pastille de
    // couleur reprend sa place, et l'écran reste lisible.
    if (error || !data) return new Map();

    const signed = new Map<string, string>();
    for (const entry of data) {
      if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
    }
    return signed;
  },
);
