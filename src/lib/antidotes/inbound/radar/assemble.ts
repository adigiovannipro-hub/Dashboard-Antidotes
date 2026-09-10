import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { decryptSecret } from "@/lib/moderation/crypto";
import type { Database } from "@/lib/supabase/database.types";
import type { PostPlatform } from "../../types";
import { createInstagramCollector } from "./instagram";
import { createInstagramApifyCollector } from "./instagram-apify";
import { createLinkedinCollector } from "./linkedin";
import { createTiktokCollector } from "./tiktok";
import type { RadarProviders } from "./types";
import { createXCollector } from "./x";
import { createYoutubeCollector } from "./youtube";

/**
 * Les connecteurs du radar, branchés par l'environnement — un réseau sans
 * clé est nommé avec ce qui lui manque, jamais tu.
 *
 *   • LinkedIn, X, TikTok : `APIFY_TOKEN` (le même que le sourcing) ;
 *   • YouTube : `YOUTUBE_API_KEY`, une clé d'API Data v3 sans OAuth ;
 *   • Instagram : le jeton d'un compte Instagram professionnel de
 *     l'inventaire Meta de l'agence — n'importe lequel, la Business
 *     Discovery lit les comptes tiers depuis un compte autorisé.
 */

export type RadarAvailability = Record<PostPlatform, string | null>;

export function radarAvailability(): RadarAvailability {
  const apify = process.env.APIFY_TOKEN?.trim() ? null : "APIFY_TOKEN absent";
  return {
    linkedin: apify,
    x: apify,
    tiktok: apify,
    youtube: process.env.YOUTUBE_API_KEY?.trim() ? null : "YOUTUBE_API_KEY absente",
    // Apify rend les vues et la vidéo ; sans lui, la Business Discovery de
    // l'inventaire Meta prend le relais — jugée au relevé.
    instagram: null,
  };
}

async function instagramCredentials(
  admin: SupabaseClient<Database>,
): Promise<{ igUserId: string; accessToken: string } | { error: string }> {
  const { data: accounts, error } = await admin
    .from("social_accounts")
    .select("id, external_id")
    .eq("kind", "instagram")
    .order("created_at", { ascending: true })
    .limit(10);
  if (error) return { error: `Inventaire Meta : ${error.message}` };
  for (const account of (accounts ?? []) as unknown as { id: string; external_id: string }[]) {
    const { data: secret } = await admin
      .from("social_account_secrets")
      .select("credentials_encrypted")
      .eq("account_id", account.id)
      .maybeSingle();
    const blob = (secret as { credentials_encrypted?: string | null } | null)?.credentials_encrypted;
    if (!blob) continue;
    try {
      return { igUserId: account.external_id, accessToken: decryptSecret(blob) };
    } catch {
      continue;
    }
  }
  return { error: "Aucun compte Instagram professionnel avec jeton dans l'inventaire Meta." };
}

export async function assembleRadarProviders(admin: SupabaseClient<Database>): Promise<RadarProviders> {
  const providers: RadarProviders = { collectors: {}, missing: {} };
  const apify = process.env.APIFY_TOKEN?.trim();
  if (apify) {
    providers.collectors.linkedin = createLinkedinCollector({ token: apify });
    providers.collectors.x = createXCollector({ token: apify });
    providers.collectors.tiktok = createTiktokCollector({ token: apify });
  } else {
    providers.missing.linkedin = providers.missing.x = providers.missing.tiktok = "APIFY_TOKEN absent";
  }
  const youtubeKey = process.env.YOUTUBE_API_KEY?.trim();
  if (youtubeKey) providers.collectors.youtube = createYoutubeCollector({ apiKey: youtubeKey });
  else providers.missing.youtube = "YOUTUBE_API_KEY absente";

  /* Instagram a deux chemins, et l'ordre compte : l'acteur Apify rend les
     **vues** d'un reel et son fichier vidéo — le score et le script en
     dépendent — là où la Business Discovery de Meta ne rend ni l'un ni
     l'autre. Elle reste le repli gratuit quand `APIFY_TOKEN` manque. */
  if (apify) {
    providers.collectors.instagram = createInstagramApifyCollector({ token: apify });
  } else {
    const instagram = await instagramCredentials(admin);
    if ("error" in instagram) {
      providers.missing.instagram = `${instagram.error} (ou APIFY_TOKEN, qui rend en plus les vues et le script)`;
    } else {
      providers.collectors.instagram = createInstagramCollector(instagram);
    }
  }
  return providers;
}
