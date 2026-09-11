import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  ClientAsset,
  ClientContext,
  ClientGenerationSettings,
  WordingHistoryEntry,
} from "./types";
import { ASSETS_BUCKET } from "./storage";

/**
 * Lectures du module Contexte client.
 *
 * Toutes passent par le client porteur de la session : la RLS de 0033 réserve
 * ces tables à l'owner, une liste vide est donc la bonne réponse pour tout
 * autre profil. Les filtres présents servent à cibler, pas à protéger.
 */

export async function getActiveContext(workspaceId: string): Promise<ClientContext | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_context")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .maybeSingle();

  return (data as unknown as ClientContext | null) ?? null;
}

export async function getContextVersion(
  workspaceId: string,
  version: number,
): Promise<ClientContext | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_context")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("version", version)
    .maybeSingle();

  return (data as unknown as ClientContext | null) ?? null;
}

/** Les versions du brief, la plus récente d'abord — pour le sélecteur. */
export async function listContextVersions(
  workspaceId: string,
  options: { limit?: number } = {},
): Promise<Pick<ClientContext, "id" | "version" | "is_active" | "created_at">[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_context")
    .select("id, version, is_active, created_at")
    .eq("workspace_id", workspaceId)
    .order("version", { ascending: false })
    .limit(options.limit ?? 50);

  return (data ?? []) as unknown as Pick<
    ClientContext,
    "id" | "version" | "is_active" | "created_at"
  >[];
}

/**
 * Le pilotage de la génération : instructions permanentes, consigne du mois,
 * contexte temporel. Absent tant que personne n'a rien écrit — une ligne n'est
 * posée qu'à la première sauvegarde, et `null` est la bonne réponse, pas une
 * panne.
 */
export async function getGenerationSettings(
  workspaceId: string,
): Promise<ClientGenerationSettings | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_generation_settings")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  return (data as unknown as ClientGenerationSettings | null) ?? null;
}

export async function listAssets(workspaceId: string): Promise<ClientAsset[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_assets")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(200);

  return (data ?? []) as unknown as ClientAsset[];
}

export async function getAsset(assetId: string): Promise<ClientAsset | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_assets")
    .select("*")
    .eq("id", assetId)
    .maybeSingle();

  return (data as unknown as ClientAsset | null) ?? null;
}

/** Les dernières accroches validées, la plus récente d'abord. */
export async function listRecentAccroches(
  workspaceId: string,
  options: { limit?: number } = {},
): Promise<WordingHistoryEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("wording_history")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 30);

  return (data ?? []) as unknown as WordingHistoryEntry[];
}

/** URL signée de courte durée pour télécharger un document. */
export async function signAssetUrl(storagePath: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(ASSETS_BUCKET)
    .createSignedUrl(storagePath, 300, { download: true });

  return data?.signedUrl ?? null;
}

/** URL signées d'un lot de documents, indexées par chemin — pour la liste. */
export async function signAssetUrls(
  storagePaths: string[],
): Promise<Record<string, string>> {
  if (storagePaths.length === 0) return {};

  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(ASSETS_BUCKET)
    .createSignedUrls(storagePaths, 3600, { download: true });

  const urls: Record<string, string> = {};
  for (const entry of data ?? []) {
    if (entry.signedUrl && entry.path) urls[entry.path] = entry.signedUrl;
  }
  return urls;
}
