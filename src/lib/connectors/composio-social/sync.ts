import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CLIENT_TOOLKIT_KIND,
  CLIENT_TOOLKIT_LABELS,
  clientUserId,
  composioClient,
  findClientAccount,
  type ClientToolkit,
} from "@/lib/composio/agency";
import type { Database } from "@/lib/supabase/database.types";
import {
  linkedinMemberProfile,
  tiktokProfile,
  tiktokVideosPage,
  xProfile,
  xTweetsPage,
  type ClientPost,
  type ClientProfile,
} from "./mapping";

/**
 * X et TikTok organiques, compte par compte, par la passerelle Composio.
 *
 * Contrairement à LinkedIn, le compte n'est pas celui de l'agence : chaque
 * client branche le sien depuis son espace (`clientUserId`). Le branchement
 * importe le profil et l'affecte à l'espace d'où il est parti — le login est
 * celui du client, il n'y a rien à deviner ; la collecte lit ensuite le fil
 * et les abonnés, rangés dans les mêmes tables qu'Instagram et LinkedIn
 * (`social_posts`, `social_followers`), sous `platform = 'x' | 'tiktok'`.
 *
 * Règle des crons appliquée partout : chaque `error` Supabase est testé.
 */

type Admin = SupabaseClient<Database>;

export type ClientSocialReport = {
  account: string;
  rows: number;
  error: string | null;
  warning?: string | null;
};

const PREMIER_PASSAGE_JOURS = 365;
const PASSAGE_COURANT_JOURS = 35;
/** Garde-fou de pagination : au-delà, on considère que le fil boucle. */
const MAX_PAGES = 25;

/** Les branchements client dont on collecte les chiffres — le profil LinkedIn ne sert qu'à publier. */
type CollectedToolkit = Exclude<ClientToolkit, "linkedin_profil">;

const PROVIDER: Record<CollectedToolkit, "x_organic" | "tiktok_organic"> = {
  twitter: "x_organic",
  tiktok: "tiktok_organic",
};

const PLATFORM: Record<CollectedToolkit, "x" | "tiktok"> = {
  twitter: "x",
  tiktok: "tiktok",
};

function fail(message: string): never {
  throw new Error(message);
}

/** La veille du passage : un relevé d'abonnés se date du jour qu'il clôture. */
function closingDate(now: Date): string {
  return new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
}

function daysBefore(now: Date, days: number): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10);
}

/* -------------------------------------------------------------------------- */
/*                                 Transport                                  */
/* -------------------------------------------------------------------------- */

async function executeTool(
  slug: string,
  workspaceId: string,
  connectedAccountId: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const version = process.env.COMPOSIO_SOCIAL_TOOL_VERSION ?? "latest";
  const result = await composioClient().tools.execute(slug, {
    userId: clientUserId(workspaceId),
    connectedAccountId,
    version,
    dangerouslySkipVersionCheck: version === "latest",
    arguments: args,
  });
  if (!result.successful) {
    fail(
      typeof result.error === "string" && result.error.length > 0
        ? result.error
        : `${slug} : réponse Composio sans détail d'erreur.`,
    );
  }
  return result.data;
}

/**
 * L'API v2 de X en passage brut. `api.twitter.com` et non `api.x.com` : c'est
 * l'hôte que la configuration de Composio déclare, et la passerelle refuse un
 * hôte qu'elle ne connaît pas.
 */
async function xGet(
  connectedAccountId: string,
  path: string,
  params: Record<string, string>,
): Promise<unknown> {
  const response = await composioClient().tools.proxyExecute({
    endpoint: `https://api.twitter.com${path}`,
    method: "GET",
    connectedAccountId,
    parameters: Object.entries(params).map(([name, value]) => ({
      in: "query" as const,
      name,
      value,
    })),
  });
  const status = Number(response.status ?? 0);
  const body = response.data as { title?: string; detail?: string } | undefined;
  if (status >= 400) {
    fail(`X ${status} ${body?.detail ?? body?.title ?? ""}`.trim());
  }
  return body;
}

/** Le membre LinkedIn derrière la connexion — OpenID, sans version d'API. */
async function linkedinUserinfo(connectedAccountId: string): Promise<unknown> {
  const response = await composioClient().tools.proxyExecute({
    endpoint: "https://api.linkedin.com/v2/userinfo",
    method: "GET",
    connectedAccountId,
  });
  const status = Number(response.status ?? 0);
  const body = response.data as { message?: string; code?: string } | undefined;
  if (status >= 400) {
    fail(`LinkedIn ${status} ${body?.code ?? ""} ${body?.message ?? ""}`.trim());
  }
  return body;
}

async function readProfile(
  toolkit: ClientToolkit,
  workspaceId: string,
  connectedAccountId: string,
): Promise<ClientProfile> {
  if (toolkit === "linkedin_profil") {
    return (
      linkedinMemberProfile(await linkedinUserinfo(connectedAccountId)) ??
      fail("LinkedIn n'a pas rendu le membre (portée openid manquante ?).")
    );
  }
  const profile =
    toolkit === "tiktok"
      ? tiktokProfile(
          await executeTool("TIKTOK_GET_USER_STATS", workspaceId, connectedAccountId, {
            fields: [
              "open_id",
              "union_id",
              "avatar_url",
              "avatar_url_100",
              "display_name",
              "username",
              "bio_description",
              "follower_count",
              "following_count",
              "likes_count",
              "video_count",
            ],
          }),
        )
      : xProfile(
          await xGet(connectedAccountId, "/2/users/me", {
            "user.fields": "public_metrics,profile_image_url,description",
          }),
        );
  return profile ?? fail(`${CLIENT_TOOLKIT_LABELS[toolkit]} n'a pas rendu de profil.`);
}

async function readPosts(options: {
  toolkit: CollectedToolkit;
  workspaceId: string;
  connectedAccountId: string;
  profile: ClientProfile;
  since: string;
}): Promise<ClientPost[]> {
  const { toolkit, workspaceId, connectedAccountId, profile, since } = options;
  const posts: ClientPost[] = [];

  if (toolkit === "tiktok") {
    let cursor: number | null = null;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const result = tiktokVideosPage(
        await executeTool("TIKTOK_LIST_VIDEOS", workspaceId, connectedAccountId, {
          max_count: 20,
          ...(cursor !== null ? { cursor } : {}),
        }),
      );
      posts.push(...result.posts);
      // Les plus récentes d'abord : on s'arrête dès qu'on passe la fenêtre.
      const oldest = result.posts.at(-1)?.publishedAt.slice(0, 10);
      if (!result.hasMore || result.cursor === null || (oldest && oldest < since)) break;
      cursor = result.cursor;
    }
  } else {
    let token: string | null = null;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const result = xTweetsPage(
        await xGet(connectedAccountId, `/2/users/${profile.externalId}/tweets`, {
          max_results: "100",
          start_time: `${since}T00:00:00Z`,
          exclude: "retweets,replies",
          "tweet.fields": "created_at,public_metrics,attachments",
          expansions: "attachments.media_keys",
          "media.fields": "type,preview_image_url,url,public_metrics",
          ...(token ? { pagination_token: token } : {}),
        }),
        profile.username,
      );
      posts.push(...result.posts);
      if (!result.nextToken) break;
      token = result.nextToken;
    }
  }

  return posts.filter((post) => post.publishedAt.slice(0, 10) >= since);
}

/* -------------------------------------------------------------------------- */
/*                                 Branchement                                */
/* -------------------------------------------------------------------------- */

/**
 * Au retour de Composio : le profil du compte branché entre dans l'inventaire
 * et s'affecte à l'espace d'où le branchement est parti.
 */
export async function importClientAccount(options: {
  admin: Admin;
  orgId: string;
  workspaceId: string;
  toolkit: ClientToolkit;
  connectedBy: string | null;
}): Promise<{ account: string } | { error: string }> {
  const { admin, toolkit, workspaceId } = options;
  const connected = await findClientAccount(toolkit, workspaceId);
  if ("error" in connected) return connected;

  let profile: ClientProfile;
  try {
    profile = await readProfile(toolkit, workspaceId, connected.id);
  } catch (error) {
    return { error: `Profil ${CLIENT_TOOLKIT_LABELS[toolkit]} illisible : ${(error as Error).message}` };
  }

  const now = new Date().toISOString();
  const kind = CLIENT_TOOLKIT_KIND[toolkit];
  const { data: saved, error } = await admin
    .from("social_accounts")
    .upsert(
      {
        org_id: options.orgId,
        kind,
        external_id: profile.externalId,
        username: profile.username,
        display_name: profile.displayName ?? profile.username,
        avatar_url: profile.avatarUrl,
        biography: profile.biography,
        followers_count: profile.followers,
        media_count: profile.mediaCount,
        parent_external_id: null,
        status: "connected",
        last_error: null,
        last_synced_at: now,
        connected_by: options.connectedBy,
        updated_at: now,
      } as never,
      { onConflict: "org_id,kind,external_id" },
    )
    .select("id")
    .single();
  if (error) return { error: `Inventaire : ${error.message}` };

  const { error: linkError } = await admin.from("workspace_social_accounts").upsert(
    {
      workspace_id: workspaceId,
      kind,
      account_id: (saved as unknown as { id: string }).id,
      org_id: options.orgId,
      assigned_by: options.connectedBy,
      updated_at: now,
    } as never,
    { onConflict: "workspace_id,kind" },
  );
  if (linkError) return { error: `Affectation : ${linkError.message}` };

  return { account: profile.username ? `@${profile.username}` : (profile.displayName ?? profile.externalId) };
}

/* -------------------------------------------------------------------------- */
/*                                  Collecte                                  */
/* -------------------------------------------------------------------------- */

export async function syncWorkspaceClientSocial(options: {
  admin: Admin;
  workspaceId: string;
  now?: Date;
  atLeastSince?: string;
}): Promise<ClientSocialReport[]> {
  const { admin, workspaceId } = options;
  const now = options.now ?? new Date();

  const { data: links, error: linkError } = await admin
    .from("workspace_social_accounts")
    .select("kind, account_id")
    .eq("workspace_id", workspaceId)
    .in("kind", ["x", "tiktok"]);
  if (linkError) fail(`Lecture des affectations X et TikTok : ${linkError.message}`);

  const reports: ClientSocialReport[] = [];
  for (const link of (links ?? []) as unknown as { kind: "x" | "tiktok"; account_id: string }[]) {
    const toolkit: CollectedToolkit = link.kind === "x" ? "twitter" : "tiktok";
    reports.push(await syncOne({ admin, workspaceId, toolkit, accountId: link.account_id, now, atLeastSince: options.atLeastSince }));
  }
  return reports;
}

async function syncOne(context: {
  admin: Admin;
  workspaceId: string;
  toolkit: CollectedToolkit;
  accountId: string;
  now: Date;
  atLeastSince?: string;
}): Promise<ClientSocialReport> {
  const { admin, workspaceId, toolkit, now } = context;
  const label = CLIENT_TOOLKIT_LABELS[toolkit];
  const report: ClientSocialReport = { account: label, rows: 0, error: null };

  try {
    const { data: row, error: accountError } = await admin
      .from("social_accounts")
      .select("id, external_id, username, display_name")
      .eq("id", context.accountId)
      .single();
    if (accountError) fail(`Compte introuvable : ${accountError.message}`);
    const account = row as unknown as {
      id: string;
      external_id: string;
      username: string | null;
      display_name: string | null;
    };
    report.account = `${label} · ${account.username ? `@${account.username}` : (account.display_name ?? account.external_id)}`;

    const connected = await findClientAccount(toolkit, workspaceId);
    if ("error" in connected) fail(connected.error);

    const { data: source, error: sourceError } = await admin
      .from("data_sources")
      .upsert(
        {
          workspace_id: workspaceId,
          provider: PROVIDER[toolkit],
          external_account_id: account.external_id,
          display_name: account.display_name ?? account.username,
          status: "connected",
        } as never,
        { onConflict: "workspace_id,provider,external_account_id" },
      )
      .select("id, last_sync_at")
      .single();
    if (sourceError) fail(`Source de données : ${sourceError.message}`);
    const { id: dataSourceId, last_sync_at } = source as unknown as {
      id: string;
      last_sync_at: string | null;
    };

    const since = [
      daysBefore(now, last_sync_at ? PASSAGE_COURANT_JOURS : PREMIER_PASSAGE_JOURS),
      context.atLeastSince,
    ]
      .filter((value): value is string => Boolean(value))
      .sort()[0]!;
    const until = closingDate(now);
    const stamp = new Date().toISOString();
    const warnings: string[] = [];

    // Le profil d'abord : il porte les abonnés, et il prouve que le jeton vit.
    const profile = await readProfile(toolkit, workspaceId, connected.id);

    if (profile.followers !== null) {
      const { error } = await admin.from("social_followers").upsert(
        {
          data_source_id: dataSourceId,
          workspace_id: workspaceId,
          platform: PLATFORM[toolkit],
          date: until,
          followers_count: profile.followers,
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
        followers_count: profile.followers,
        media_count: profile.mediaCount,
        avatar_url: profile.avatarUrl,
        last_synced_at: stamp,
        status: "connected",
        last_error: null,
      } as never)
      .eq("id", account.id);
    if (vitrineError) fail(`Vitrine du compte : ${vitrineError.message}`);

    /* Un refus sur le fil — portée absente, palier d'API de X — ne doit pas
       priver le client de sa courbe d'abonnés : il devient un avertissement. */
    try {
      const posts = await readPosts({ toolkit, workspaceId, connectedAccountId: connected.id, profile, since });
      if (posts.length > 0) {
        const { error } = await admin.from("social_posts").upsert(
          posts.map((post) => ({
            data_source_id: dataSourceId,
            workspace_id: workspaceId,
            platform: PLATFORM[toolkit],
            external_id: post.externalId,
            published_at: post.publishedAt,
            caption: post.caption,
            permalink: post.permalink,
            media_kind: post.mediaKind,
            thumbnail_url: post.thumbnailUrl,
            impressions: post.impressions,
            reach: 0,
            video_views: post.videoViews,
            likes: post.likes,
            comments: post.comments,
            shares: post.shares,
            saves: post.saves,
            updated_at: stamp,
          })) as never,
          { onConflict: "data_source_id,external_id" },
        );
        if (error) fail(`Publications : ${error.message}`);
        report.rows += posts.length;
      }
    } catch (error) {
      warnings.push(`Publications non lues : ${(error as Error).message}`);
    }

    report.warning = warnings.length > 0 ? warnings.join(" — ") : null;
    const { error: sourceDone } = await admin
      .from("data_sources")
      .update({ status: "connected", last_sync_at: stamp, last_error: report.warning } as never)
      .eq("id", dataSourceId);
    if (sourceDone) fail(`Mise à jour de la source : ${sourceDone.message}`);
  } catch (error) {
    report.error = (error as Error).message;
  }

  return report;
}
