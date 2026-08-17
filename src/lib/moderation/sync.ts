import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  igCommentsToThreads,
  pageCommentsToThreads,
} from "@/lib/connectors/meta/comments";
import { explainMetaError } from "@/lib/connectors/meta/errors";
import {
  fetchInstagramComments,
  fetchInstagramMediaLite,
  fetchPageComments,
  fetchPagePostsLite,
} from "@/lib/connectors/meta/graph";
import type { SocialAccountRow } from "@/lib/social/types";
import type { Database } from "@/lib/supabase/database.types";
import { decryptSecret } from "./crypto";
import { planThreadState } from "./ingest";
import type { IngestedThread } from "./ingest";
import type { ModerationChannel, ModerationClient } from "./types";

/**
 * Synchronisation de l'inbox depuis les comptes branchés dans Connexions.
 *
 * La Modération ne se branche pas : elle **suit** ce que les clients ont déjà
 * branché. Chaque espace qui porte un compte Instagram ou une Page affectés
 * (`workspace_social_accounts`) remonte ses commentaires dans le client de
 * modération rattaché à l'espace — créé au premier passage s'il n'existe pas.
 *
 * Chemin du projet : plateforme → base → lecture locale. Upserts par
 * identifiant externe, rejouer un passage ne duplique rien, et **chaque
 * `error` Supabase est testé** — la règle des crons.
 */

type Admin = SupabaseClient<Database>;

/** Les commentaires se relèvent sur les publications des 60 derniers jours. */
const POSTS_WINDOW_DAYS = 60;

export type ModerationSyncReport = {
  workspace: string;
  channel: ModerationChannel;
  account: string;
  /** Fils vus sur la plateforme pendant ce passage. */
  threads: number;
  error: string | null;
};

function fail(message: string): never {
  throw new Error(message);
}

function sinceDate(): string {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - POSTS_WINDOW_DAYS);
  return since.toISOString().slice(0, 10);
}

/** `since` en secondes Unix, le format de `/published_posts`. */
function unixSince(date: string): string {
  return String(Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000));
}

type LinkedWorkspace = {
  id: string;
  org_id: string;
  slug: string;
  name: string;
};

/**
 * Le client de modération d'un espace — trouvé, adopté ou créé.
 *
 * L'adoption couvre la démo : un client posé à la main avec le slug de
 * l'espace (« bondet ») se rattache au lieu d'être doublé. Ce n'est pas une
 * affectation devinée : espace et client de modération sont 1:1 par
 * construction (`moderation_clients.workspace_id`).
 */
async function ensureModerationClient(
  admin: Admin,
  workspace: LinkedWorkspace,
): Promise<ModerationClient> {
  const { data: linked, error: linkedError } = await admin
    .from("moderation_clients")
    .select("*")
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (linkedError) fail(`Client de modération : ${linkedError.message}`);
  if (linked) return linked as unknown as ModerationClient;

  const { data: sameSlug, error: sameSlugError } = await admin
    .from("moderation_clients")
    .select("*")
    .eq("org_id", workspace.org_id)
    .eq("slug", workspace.slug)
    .is("workspace_id", null)
    .maybeSingle();
  if (sameSlugError) fail(`Client de modération : ${sameSlugError.message}`);

  if (sameSlug) {
    const { data: adopted, error: adoptError } = await admin
      .from("moderation_clients")
      .update({ workspace_id: workspace.id } as never)
      .eq("id", (sameSlug as unknown as ModerationClient).id)
      .select("*")
      .single();
    if (adoptError) fail(`Rattachement du client : ${adoptError.message}`);
    return adopted as unknown as ModerationClient;
  }

  const { data: created, error: createError } = await admin
    .from("moderation_clients")
    .insert({
      org_id: workspace.org_id,
      workspace_id: workspace.id,
      slug: workspace.slug,
      name: workspace.name,
    } as never)
    .select("*")
    .single();
  if (createError) fail(`Création du client : ${createError.message}`);
  return created as unknown as ModerationClient;
}

/** Écrit les fils d'un passage : conversations puis messages, en upsert. */
async function upsertThreads(options: {
  admin: Admin;
  client: ModerationClient;
  connectionId: string;
  channel: ModerationChannel;
  threads: IngestedThread[];
}): Promise<number> {
  const { admin, client, connectionId, channel, threads } = options;
  if (threads.length === 0) return 0;

  const { data: existingRows, error: existingError } = await admin
    .from("conversations")
    .select(
      "id, external_thread_id, status, unread, priority, flags, last_message_at, deleted_at",
    )
    .eq("client_id", client.id)
    .eq("channel", channel)
    .in(
      "external_thread_id",
      threads.map((thread) => thread.externalThreadId),
    );
  if (existingError) fail(`Lecture des conversations : ${existingError.message}`);

  const existingByThread = new Map(
    (
      (existingRows ?? []) as unknown as {
        id: string;
        external_thread_id: string;
        status: string;
        unread: boolean;
        priority: string;
        flags: string[];
        last_message_at: string;
        deleted_at: string | null;
      }[]
    ).map((row) => [row.external_thread_id, row]),
  );

  const fallbackLocale = client.locale_default;
  const rows = threads.flatMap((thread) => {
    const existing = existingByThread.get(thread.externalThreadId) ?? null;
    // Une conversation supprimée à la demande le reste : le passage ne
    // ressuscite rien.
    if (existing?.deleted_at) return [];

    const plan = planThreadState({
      existing: existing
        ? {
            status: existing.status as never,
            unread: existing.unread,
            priority: existing.priority as never,
            flags: existing.flags as never,
            last_message_at: existing.last_message_at,
          }
        : null,
      thread,
      fallbackLocale,
    });

    return [
      {
        client_id: client.id,
        connection_id: connectionId,
        channel,
        external_thread_id: thread.externalThreadId,
        kind: thread.kind,
        participant_external_id: thread.participantExternalId,
        participant_handle: thread.participantHandle,
        participant_avatar_url: thread.participantAvatarUrl,
        status: plan.status,
        priority: plan.priority,
        unread: plan.unread,
        flags: plan.flags,
        detected_locale: plan.detected_locale,
        excerpt: plan.excerpt,
        post_external_id: thread.post?.externalId ?? null,
        post_permalink: thread.post?.permalink ?? null,
        post_excerpt: thread.post?.excerpt ?? null,
        post_thumbnail_url: thread.post?.thumbnailUrl ?? null,
        message_count: plan.message_count,
        last_message_at: plan.last_message_at,
      },
    ];
  });

  if (rows.length === 0) return 0;

  const { data: saved, error: upsertError } = await admin
    .from("conversations")
    .upsert(rows as never, { onConflict: "client_id,channel,external_thread_id" })
    .select("id, external_thread_id");
  if (upsertError) fail(`Écriture des conversations : ${upsertError.message}`);

  const conversationIds = new Map(
    ((saved ?? []) as unknown as { id: string; external_thread_id: string }[]).map(
      (row) => [row.external_thread_id, row.id],
    ),
  );

  const messageRows = threads.flatMap((thread) => {
    const conversationId = conversationIds.get(thread.externalThreadId);
    if (!conversationId) return [];
    return thread.messages.map((message) => ({
      conversation_id: conversationId,
      client_id: client.id,
      direction: message.fromBrand ? "outbound" : "inbound",
      external_message_id: message.externalId,
      author_external_id: message.authorExternalId,
      author_handle: message.authorHandle,
      body: message.body,
      origin: "platform",
      sent_at: message.sentAt,
    }));
  });

  if (messageRows.length > 0) {
    // `ignoreDuplicates` : un message déjà en base garde sa ligne — en
    // particulier une réponse envoyée depuis l'outil, dont l'origine
    // `antidotes` ne doit pas être réécrite en `platform`.
    const { error: messagesError } = await admin
      .from("messages")
      .upsert(messageRows as never, {
        onConflict: "conversation_id,external_message_id",
        ignoreDuplicates: true,
      });
    if (messagesError) fail(`Écriture des messages : ${messagesError.message}`);
  }

  return rows.length;
}

/**
 * Relève les commentaires d'un compte — publications récentes, puis
 * commentaires des seules publications qui en portent.
 */
async function pullThreads(options: {
  account: SocialAccountRow;
  accessToken: string;
  channel: ModerationChannel;
}): Promise<IngestedThread[]> {
  const { account, accessToken, channel } = options;
  const since = sinceDate();
  const threads: IngestedThread[] = [];

  if (channel === "instagram") {
    const media = await fetchInstagramMediaLite({
      igUserId: account.external_id,
      accessToken,
      since,
    });
    const brand = { externalId: account.external_id, username: account.username };

    for (const item of media) {
      // Une story ne reçoit pas de commentaires ; zéro commentaire, zéro appel.
      if (item.media_product_type === "STORY") continue;
      if (!item.comments_count) continue;
      const comments = await fetchInstagramComments({
        mediaId: item.id,
        accessToken,
      });
      threads.push(...igCommentsToThreads({ media: item, comments, brand }));
    }
    return threads;
  }

  const posts = await fetchPagePostsLite({
    pageId: account.external_id,
    accessToken,
    since: unixSince(since),
  });
  const brand = { externalId: account.external_id };

  for (const post of posts) {
    if (!post.comments?.summary?.total_count) continue;
    const comments = await fetchPageComments({ postId: post.id, accessToken });
    threads.push(...pageCommentsToThreads({ post, comments, brand }));
  }
  return threads;
}

export async function syncModerationInbox(options: {
  admin: Admin;
}): Promise<ModerationSyncReport[]> {
  const { admin } = options;
  const reports: ModerationSyncReport[] = [];

  const { data: links, error: linksError } = await admin
    .from("workspace_social_accounts")
    .select("workspace_id, kind, account_id")
    .in("kind", ["instagram", "facebook_page"]);
  if (linksError) fail(`Lecture des affectations : ${linksError.message}`);

  const linkRows = (links ?? []) as unknown as {
    workspace_id: string;
    kind: "instagram" | "facebook_page";
    account_id: string;
  }[];
  if (linkRows.length === 0) return reports;

  const { data: workspaces, error: workspacesError } = await admin
    .from("workspaces")
    .select("id, org_id, slug, name")
    .in("id", [...new Set(linkRows.map((link) => link.workspace_id))]);
  if (workspacesError) fail(`Lecture des espaces : ${workspacesError.message}`);

  const workspaceById = new Map(
    ((workspaces ?? []) as unknown as LinkedWorkspace[]).map((workspace) => [
      workspace.id,
      workspace,
    ]),
  );

  for (const link of linkRows) {
    const workspace = workspaceById.get(link.workspace_id);
    if (!workspace) continue;

    const channel: ModerationChannel =
      link.kind === "instagram" ? "instagram" : "facebook";
    const report: ModerationSyncReport = {
      workspace: workspace.name,
      channel,
      account: link.account_id,
      threads: 0,
      error: null,
    };
    reports.push(report);

    try {
      const client = await ensureModerationClient(admin, workspace);

      const { data: accountRow, error: accountError } = await admin
        .from("social_accounts")
        .select("*")
        .eq("id", link.account_id)
        .single();
      if (accountError) fail(`Compte introuvable : ${accountError.message}`);
      const account = accountRow as unknown as SocialAccountRow;
      report.account = account.display_name ?? account.username ?? account.external_id;

      const { data: secret, error: secretError } = await admin
        .from("social_account_secrets")
        .select("credentials_encrypted")
        .eq("account_id", link.account_id)
        .maybeSingle();
      if (secretError) fail(`Lecture du jeton : ${secretError.message}`);
      const blob = (secret as { credentials_encrypted?: string } | null)
        ?.credentials_encrypted;
      if (!blob) fail("Aucun jeton enregistré — rebrancher Meta depuis Connexions.");
      const accessToken = decryptSecret(blob);

      // Le journal de passage du canal : une ligne par (client, canal,
      // compte), le même rôle que `data_sources` au Reporting.
      const { data: connection, error: connectionError } = await admin
        .from("channel_connections")
        .upsert(
          {
            client_id: client.id,
            channel,
            external_account_id: account.external_id,
            display_name: report.account,
            ingestion_mode: "polling",
            status: "connected",
          } as never,
          { onConflict: "client_id,channel,external_account_id" },
        )
        .select("id")
        .single();
      if (connectionError) fail(`Connexion du canal : ${connectionError.message}`);
      const connectionId = (connection as unknown as { id: string }).id;

      try {
        const threads = await pullThreads({ account, accessToken, channel });
        report.threads = await upsertThreads({
          admin,
          client,
          connectionId,
          channel,
          threads,
        });

        const { error: doneError } = await admin
          .from("channel_connections")
          .update({
            status: "connected",
            last_polled_at: new Date().toISOString(),
            last_error: null,
          } as never)
          .eq("id", connectionId);
        if (doneError) fail(`Clôture du passage : ${doneError.message}`);
      } catch (error) {
        const message = explainMetaError((error as Error).message).message;
        await admin
          .from("channel_connections")
          .update({ status: "error", last_error: message } as never)
          .eq("id", connectionId);
        throw error;
      }
    } catch (error) {
      report.error = explainMetaError((error as Error).message).message;
    }
  }

  return reports;
}
