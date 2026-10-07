import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import { youtubeCall } from "@/lib/social/youtube";
import { usableAccessToken } from "./credentials";
import { explainYouTubeError } from "./errors";
import {
  channelStats,
  reportingVideos,
  uploadsPage,
  type YouTubeReportingVideo,
} from "./reporting-mapping";

/**
 * Le Reporting YouTube d'un espace : les vidéos de la chaîne affectée et ses
 * abonnés, rangés dans les mêmes tables qu'Instagram et TikTok
 * (`social_posts`, `social_followers`) sous `platform = 'youtube'`.
 *
 * **Aucun branchement de plus.** La chaîne est déjà reliée à Google en
 * direct pour l'Inbox — jeton chiffré dans `social_account_secrets`,
 * renouvelé ici quand il a expiré. La portée `youtube.force-ssl` ouvre la
 * lecture de l'API Data, qui suffit : vues, j'aime, commentaires, abonnés.
 *
 * **Toute l'histoire à chaque passage.** L'API ne rend que des cumuls par
 * vidéo : une fenêtre glissante figerait les vues des anciennes vidéos au
 * jour où elles en sont sorties. Relire toutes les mises en ligne coûte une
 * unité de quota par tranche de cinquante vidéos (playlist, puis détail), là
 * où le quota du jour est de 10 000 — et l'Inbox en consomme une par page de
 * commentaires.
 *
 * Règle des crons appliquée partout : chaque `error` Supabase est testé.
 */

type Admin = SupabaseClient<Database>;

export type YouTubeReportingReport = {
  account: string;
  rows: number;
  error: string | null;
};

/** Garde-fou de pagination : 20 pages de 50, soit mille vidéos. */
const MAX_PAGES = 20;

function fail(message: string): never {
  throw new Error(message);
}

/** La veille du passage : un relevé d'abonnés se date du jour qu'il clôture. */
function closingDate(now: Date): string {
  return new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
}

async function readVideos(
  uploadsPlaylistId: string,
  accessToken: string,
): Promise<YouTubeReportingVideo[]> {
  const ids: string[] = [];
  let pageToken: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = uploadsPage(
      await youtubeCall<unknown>(
        "/playlistItems",
        {
          part: "contentDetails",
          playlistId: uploadsPlaylistId,
          maxResults: "50",
          ...(pageToken ? { pageToken } : {}),
        },
        accessToken,
      ),
    );
    ids.push(...result.videoIds);
    if (!result.nextPageToken) break;
    pageToken = result.nextPageToken;
  }

  const unique = [...new Set(ids)];
  const videos: YouTubeReportingVideo[] = [];
  for (let start = 0; start < unique.length; start += 50) {
    videos.push(
      ...reportingVideos(
        await youtubeCall<unknown>(
          "/videos",
          {
            part: "snippet,statistics,status",
            id: unique.slice(start, start + 50).join(","),
            maxResults: "50",
          },
          accessToken,
        ),
      ),
    );
  }
  return videos;
}

export async function syncWorkspaceYoutube(options: {
  admin: Admin;
  workspaceId: string;
  now?: Date;
}): Promise<YouTubeReportingReport[]> {
  const { admin, workspaceId } = options;
  const now = options.now ?? new Date();

  const { data: link, error: linkError } = await admin
    .from("workspace_social_accounts")
    .select("account_id")
    .eq("workspace_id", workspaceId)
    .eq("kind", "youtube")
    .maybeSingle();
  if (linkError) fail(`Lecture de l'affectation YouTube : ${linkError.message}`);
  const accountId = (link as { account_id?: string } | null)?.account_id;
  if (!accountId) return [];

  const report: YouTubeReportingReport = { account: "YouTube", rows: 0, error: null };
  let dataSourceId: string | null = null;

  try {
    const { data: row, error: accountError } = await admin
      .from("social_accounts")
      .select("id, external_id, username, display_name")
      .eq("id", accountId)
      .single();
    if (accountError) fail(`Chaîne introuvable : ${accountError.message}`);
    const account = row as unknown as {
      id: string;
      external_id: string;
      username: string | null;
      display_name: string | null;
    };
    report.account = `YouTube · ${account.username ?? account.display_name ?? account.external_id}`;

    const { data: secret, error: secretError } = await admin
      .from("social_account_secrets")
      .select("credentials_encrypted")
      .eq("account_id", accountId)
      .maybeSingle();
    if (secretError) fail(`Lecture du jeton : ${secretError.message}`);
    const blob = (secret as { credentials_encrypted?: string } | null)?.credentials_encrypted;
    if (!blob) fail("Aucun jeton enregistré — rebrancher YouTube depuis Connexions.");

    const usable = await usableAccessToken(blob);
    // Réécrit tout de suite : sinon chaque passage redemanderait un jeton.
    if (usable.refreshed) {
      const { error } = await admin
        .from("social_account_secrets")
        .update({ credentials_encrypted: usable.refreshed, updated_at: new Date().toISOString() } as never)
        .eq("account_id", accountId);
      if (error) fail(`Jeton rafraîchi : ${error.message}`);
    }

    const { data: source, error: sourceError } = await admin
      .from("data_sources")
      .upsert(
        {
          workspace_id: workspaceId,
          provider: "youtube_organic",
          external_account_id: account.external_id,
          display_name: account.display_name ?? account.username,
          status: "connected",
        } as never,
        { onConflict: "workspace_id,provider,external_account_id" },
      )
      .select("id")
      .single();
    if (sourceError) fail(`Source de données : ${sourceError.message}`);
    dataSourceId = (source as unknown as { id: string }).id;

    const channel = channelStats(
      await youtubeCall<unknown>(
        "/channels",
        { part: "snippet,statistics,contentDetails", id: account.external_id },
        usable.accessToken,
      ),
      account.external_id,
    );
    if (!channel) fail("YouTube ne rend pas cette chaîne — rebrancher YouTube depuis Connexions.");

    const stamp = new Date().toISOString();

    if (channel.subscribers !== null) {
      const { error } = await admin.from("social_followers").upsert(
        {
          data_source_id: dataSourceId,
          workspace_id: workspaceId,
          platform: "youtube",
          date: closingDate(now),
          followers_count: channel.subscribers,
          source: "api",
          updated_at: stamp,
        } as never,
        { onConflict: "data_source_id,platform,date" },
      );
      if (error) fail(`Abonnés : ${error.message}`);
      report.rows += 1;
    }

    const { error: vitrineError } = await admin
      .from("social_accounts")
      .update({
        followers_count: channel.subscribers,
        media_count: channel.videoCount,
        ...(channel.avatarUrl ? { avatar_url: channel.avatarUrl } : {}),
        last_synced_at: stamp,
        status: "connected",
        last_error: null,
      } as never)
      .eq("id", account.id);
    if (vitrineError) fail(`Vitrine de la chaîne : ${vitrineError.message}`);

    const videos = channel.uploadsPlaylistId
      ? await readVideos(channel.uploadsPlaylistId, usable.accessToken)
      : [];

    if (videos.length > 0) {
      const { error } = await admin.from("social_posts").upsert(
        videos.map((video) => ({
          data_source_id: dataSourceId,
          workspace_id: workspaceId,
          platform: "youtube",
          external_id: video.externalId,
          published_at: video.publishedAt,
          caption: video.caption,
          permalink: video.permalink,
          media_kind: "video",
          thumbnail_url: video.thumbnailUrl,
          /* Les vues portent les deux colonnes, comme sur TikTok : une vidéo
             YouTube est vue par définition, et le taux d'engagement se
             rapporte aux vues faute de portée. */
          impressions: video.views,
          reach: 0,
          video_views: video.views,
          likes: video.likes,
          comments: video.comments,
          shares: 0,
          saves: 0,
          updated_at: stamp,
        })) as never,
        { onConflict: "data_source_id,external_id" },
      );
      if (error) fail(`Vidéos : ${error.message}`);
      report.rows += videos.length;
    }

    const { error: sourceDone } = await admin
      .from("data_sources")
      .update({ status: "connected", last_sync_at: stamp, last_error: null } as never)
      .eq("id", dataSourceId);
    if (sourceDone) fail(`Mise à jour de la source : ${sourceDone.message}`);
  } catch (error) {
    report.error = explainYouTubeError((error as Error).message).message;
    if (dataSourceId) {
      // La trace du refus sur la source : l'écran des synchronisations la lit.
      await admin
        .from("data_sources")
        .update({ last_error: report.error } as never)
        .eq("id", dataSourceId);
    }
  }

  return [report];
}
