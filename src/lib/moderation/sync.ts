import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  igCommentsToThreads,
  pageCommentsToThreads,
} from "@/lib/connectors/meta/comments";
import { explainMetaError, isTransientMeta } from "@/lib/connectors/meta/errors";
import { explainYouTubeError } from "@/lib/connectors/youtube/errors";
import {
  fetchCommentAuthors,
  fetchConversationHeaders,
  fetchConversationMessages,
  fetchConversationParticipants,
  fetchConversations,
  fetchInstagramComments,
  fetchInstagramMediaLite,
  fetchMessagingProfiles,
  fetchPageComments,
  fetchPagePostsLite,
  GRAPH_TIMEOUT_MS,
} from "@/lib/connectors/meta/graph";
import {
  conversationsToThreads,
  type MetaConversationRow,
} from "@/lib/connectors/meta/messages";
import {
  fetchChannelCommentThreads,
  fetchVideos,
} from "@/lib/connectors/youtube/api";
import {
  threadsToConversations,
  videoIdsOf,
} from "@/lib/connectors/youtube/comments";
import { usableAccessToken } from "@/lib/connectors/youtube/credentials";
import type { SocialAccountRow } from "@/lib/social/types";
import type { Database } from "@/lib/supabase/database.types";
import { decryptSecret } from "./crypto";
import {
  DM_DEFERRED_WARNING,
  dmHeadersOnlyNote,
  dmUnavailableWarning,
  shouldPullDirectMessages,
  startsAtHeaders,
} from "./dm-availability";
import {
  faqEmbeddingText,
  getEmbeddingProvider,
  pendingEmbeddingFilter,
  toPgVector,
} from "./embeddings";
import { planThreadState, sanitizeText } from "./ingest";
import {
  backfillsProfiles,
  conversationSince,
  directMessageStepBudget,
  usesPostCursors,
  type SyncScope,
} from "./sync-scope";
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
 *
 * Deux portées depuis le 14/09 (`sync-scope.ts`), et c'est ce qui rend le
 * relevé supportable à l'ouverture d'un écran :
 *
 *   • `jour` — deux jours de conversations, les commentaires des seules
 *     publications dont `comments_count` a bougé depuis le dernier passage
 *     (`moderation_post_cursors`), aucun rattrapage de profil ni d'auteur
 *     masqué. Quelques appels par compte.
 *   • `complet` — soixante jours, tout redescendu, rattrapages compris. La
 *     passe de réparation, jouée la nuit sur un runner GitHub.
 *
 * La liste des publications, elle, couvre soixante jours dans les deux cas :
 * un commentaire arrive aujourd'hui sous un reel d'il y a six semaines, et la
 * raccourcir reviendrait à ne jamais le voir.
 *
 * Et depuis le 16/09, la **boîte privée est budgétée** : un palier de repli à
 * l'ouverture de l'écran, trois la nuit, chacun au prix d'un seul appel — et
 * une boîte refusée la veille ne se retente qu'au passage complet
 * (`dm-availability.ts`). Le relevé horaire passait 750 s sur 872 dans deux
 * boîtes Instagram que Meta refusait, palier après palier, reprise après
 * reprise. Le temps passé par canal est désormais dans le rapport.
 *
 * Le budget se compte en **temps**, pas seulement en paliers, et il se
 * partage : `DM_BUDGET_MS` borne une boîte de bout en bout, et l'appelant
 * peut poser une **échéance** sur le passage entier (`deadline`) — la route
 * Vercel n'a que soixante secondes pour tous les canaux, en série, et 45 s
 * par boîte auraient fait couper la fonction au deuxième canal, avant que sa
 * mémoire soit écrite. Chaque appel reçoit ce qui reste ; une boîte qu'on
 * n'a plus le temps de demander est **reportée**, pas déclarée refusée.
 */

type Admin = SupabaseClient<Database>;

/** Les commentaires se relèvent sur les publications des 60 derniers jours. */
const POSTS_WINDOW_DAYS = 60;

/**
 * Fenêtres de repli quand Meta refuse la demande pour son volume — vécu sur
 * les comptes Instagram de Bondet et d'I-WAY : mieux vaut 21 jours qui passent
 * que 60 qui échouent, le passage suivant rattrapera le reste.
 */
const FALLBACK_WINDOW_DAYS = [21, 7];

/** Le refus de volume de Meta — le seul qui justifie de redemander plus petit. */
function isTooMuchData(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes("reduce the amount of data")
  );
}

/**
 * Les deux refus qui veulent dire « redemande plus petit ».
 *
 * L'escalier ne descendait que sur « reduce the amount of data ». Or la boîte
 * privée d'Instagram ne renvoie pas ça : elle renvoie « long polling
 * terminated due to timeout » ou un 504 — Meta n'assemble pas 50 fils × 25
 * messages avec leurs pièces jointes dans son délai. Ce refus-là remontait tel
 * quel dès le premier palier et finissait en avertissement muet : zéro DM
 * Instagram en base depuis le premier jour, pendant que les commentaires
 * passaient. Un timeout est le symptôme d'une demande trop lourde, il doit
 * descendre l'escalier.
 */
function shouldStepDown(error: unknown): boolean {
  return isTooMuchData(error) || isTransientMeta(error);
}

/** Combien de photos de profil d'interlocuteurs se rattrapent par passage. */
const AVATAR_BACKFILL_CAP = 50;

/**
 * L'escalier de la boîte privée, du palier réduit au strict minimum.
 *
 * Deux formes, dans cet ordre : le listing avec ses messages développés — on
 * **part** du palier réduit et on ne monte jamais, 50 fils × 25 messages avec
 * pièces jointes étant précisément ce que Meta ne sait pas assembler — puis
 * les en-têtes nus, fil par fil ensuite, chaque appel de taille bornée. Le
 * palier « 50 en-têtes avec participants » a disparu : Meta le refusait sur
 * la Page Bondet, et trente fils suffisent au relevé (`DM_HEADERS_CAP`).
 *
 * C'est `directMessageStepBudget` qui dit combien de ces paliers un passage
 * peut descendre : un à l'ouverture de l'écran, trois la nuit.
 */
type DirectMessageStep =
  | {
      kind: "conversations";
      pageSize: number;
      messageLimit: number;
      withAttachments?: boolean;
    }
  | { kind: "headers"; pageSize: number; withParticipants?: boolean };

const DIRECT_MESSAGE_LADDER: readonly DirectMessageStep[] = [
  { kind: "conversations", pageSize: 20, messageLimit: 10 },
  { kind: "conversations", pageSize: 10, messageLimit: 5, withAttachments: false },
  { kind: "headers", pageSize: 10 },
  { kind: "headers", pageSize: 5, withParticipants: false },
];

/** Combien de fils au plus se redemandent un par un après le listing d'en-têtes. */
const DM_HEADERS_CAP = 30;

/**
 * Le temps qu'un canal peut passer dans sa boîte privée, **paliers et fils
 * compris**, compté depuis le premier appel. Une seule borne, vérifiée avant
 * chaque appel : l'ancienne — deux minutes sur les seuls fils, testée en tête
 * de boucle — laissait deux paliers en timeout (90 s) puis un fil entamé à
 * 119 s coûter encore deux appels de 45 s, soit cinq minutes par canal avant
 * même les commentaires. Ce qui reste attend le passage suivant, qui repart
 * des fils les plus récents.
 */
const DM_BUDGET_MS = 180_000;

/**
 * En dessous, on ne demande plus rien : un appel qu'on coupera à coup sûr
 * n'apprend rien sur la boîte, et coûterait sa mémoire — un timeout sur
 * trois secondes de budget n'est pas un refus de Meta. Dix secondes, c'est
 * plus que ce qu'une boîte qui **répond** met à rendre son palier réduit
 * (Messenger : deux à cinq secondes mesurées) : ce qui dépasse ce seuil sans
 * répondre est bien la boîte qui renonce.
 */
const DM_MIN_CALL_MS = 10_000;

/**
 * Un canal que le passage n'a pas eu le temps d'entamer. Rien n'est écrit en
 * base — son journal garde le relevé précédent — et le rapport le dit.
 */
const CHANNEL_DEFERRED_WARNING =
  "Canal reporté au passage suivant : le relevé n'avait plus le temps de l'entamer.";

export type ModerationSyncReport = {
  workspace: string;
  channel: ModerationChannel;
  account: string;
  /** Fils vus sur la plateforme pendant ce passage. */
  threads: number;
  error: string | null;
  /**
   * Le relevé des messages privés a échoué alors que les commentaires sont
   * passés : la boîte privée demande ses propres portées, et son refus ne doit
   * pas faire tomber le reste — il devient un avertissement.
   */
  messagesWarning?: string | null;
  /**
   * Le temps passé sur ce canal, et la part des messages privés dedans. La
   * sonde qui manquait : 750 s sur 872 sont partis dans une boîte refusée
   * sans qu'une ligne du journal le dise.
   */
  elapsedMs: number;
  directMessagesMs: number;
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

/**
 * Les compteurs de commentaires vus au dernier passage réussi.
 *
 * `null` quand la table n'est pas là — la migration part au merge : le relevé
 * redescend alors tout, exactement comme avant. Une passe longue vaut mieux
 * qu'un canal en erreur.
 */
async function loadPostCursors(options: {
  admin: Admin;
  clientId: string;
  channel: ModerationChannel;
}): Promise<Map<string, number> | null> {
  const { data, error } = await options.admin
    .from("moderation_post_cursors")
    .select("post_external_id, comments_count")
    .eq("client_id", options.clientId)
    .eq("channel", options.channel);
  if (error) return null;

  return new Map(
    (
      (data ?? []) as unknown as {
        post_external_id: string;
        comments_count: number;
      }[]
    ).map((row) => [row.post_external_id, row.comments_count]),
  );
}

/**
 * Les compteurs des publications **réellement descendues** pendant ce passage.
 *
 * Écrits après coup et jamais avant : une publication dont l'appel a été
 * refusé ne doit pas passer pour vue, sinon son commentaire manquant ne
 * reviendrait plus jamais. Un échec d'écriture se tait pour la même raison
 * qu'il est sans danger — le passage suivant redescendra ce qu'il n'a pas su
 * mémoriser.
 */
async function savePostCursors(options: {
  admin: Admin;
  clientId: string;
  channel: ModerationChannel;
  seen: Map<string, number>;
}): Promise<void> {
  if (options.seen.size === 0) return;
  const now = new Date().toISOString();
  await options.admin.from("moderation_post_cursors").upsert(
    [...options.seen].map(([postExternalId, commentsCount]) => ({
      client_id: options.clientId,
      channel: options.channel,
      post_external_id: postExternalId,
      comments_count: commentsCount,
      last_seen_at: now,
    })) as never,
    { onConflict: "client_id,channel,post_external_id" },
  );
}

/**
 * Les interlocuteurs dont la photo est déjà en base.
 *
 * `conversationToThread` pose `participantAvatarUrl: null` en dur — la photo
 * ne vient pas du listing — et la collecte ne relisait jamais la base : chaque
 * passage complet redemandait les cinquante mêmes personnes, une par une, pour
 * réécrire ce qui était déjà là.
 */
async function avatarsAlreadyKnown(options: {
  admin: Admin;
  clientId: string;
  channel: ModerationChannel;
}): Promise<Set<string>> {
  const { data } = await options.admin
    .from("conversations")
    .select("participant_external_id")
    .eq("client_id", options.clientId)
    .eq("channel", options.channel)
    .not("participant_avatar_url", "is", null)
    .limit(2000);

  return new Set(
    ((data ?? []) as unknown as { participant_external_id: string | null }[])
      .map((row) => row.participant_external_id)
      .filter((id): id is string => Boolean(id)),
  );
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
      "id, external_thread_id, status, unread, priority, flags, last_message_at, deleted_at, participant_avatar_url, message_count",
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
        participant_avatar_url: string | null;
        message_count: number | null;
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
        participant_handle: sanitizeText(thread.participantHandle),
        /* La photo la plus fraîche gagne, et l'ancienne ne survit qu'à défaut :
           les URL `scontent.*.fbcdn.net` et `lookaside.fbsbx.com` sont signées
           et périment en quelques jours — c'est la fenêtre glissante du relevé
           qui les renouvelle, en repassant sur les mêmes fils. Une photo déjà
           rattrapée survit en revanche à un passage qui n'en rapporte pas :
           Meta ne rend l'avatar qu'à certains appels, pas à tous. */
        participant_avatar_url:
          thread.participantAvatarUrl ?? existing?.participant_avatar_url ?? null,
        status: plan.status,
        priority: plan.priority,
        unread: plan.unread,
        flags: plan.flags,
        detected_locale: plan.detected_locale,
        excerpt: sanitizeText(plan.excerpt),
        post_external_id: thread.post?.externalId ?? null,
        post_permalink: thread.post?.permalink ?? null,
        post_excerpt: sanitizeText(thread.post?.excerpt ?? null),
        post_thumbnail_url: thread.post?.thumbnailUrl ?? null,
        /* Jamais moins que ce qui est déjà en base. `planThreadState` compte
           les messages **que ce passage a vus**, et le palier réduit de la
           messagerie n'en demande que dix : sans ce plancher, un fil qui en
           portait vingt-cinq verrait son compteur reculer à chaque relevé —
           une régression visible à l'écran, pour une donnée que Meta n'a
           simplement pas redite. */
        message_count: Math.max(plan.message_count, existing?.message_count ?? 0),
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
      author_handle: sanitizeText(message.authorHandle),
      body: sanitizeText(message.body),
      attachments: message.attachments.map((attachment) => ({
        ...attachment,
        title: sanitizeText(attachment.title),
      })),
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
  admin: Admin;
  clientId: string;
  account: SocialAccountRow;
  accessToken: string;
  channel: "instagram" | "facebook" | "youtube";
  scope: SyncScope;
  /** `channel_connections.last_error` du passage précédent — la mémoire du refus. */
  lastError: string | null;
  /** L'instant (ms epoch) au-delà duquel l'appelant sera coupé — la route Vercel. */
  deadline?: number;
}): Promise<{
  threads: IngestedThread[];
  warning: string | null;
  directMessagesMs: number;
}> {
  const { admin, clientId, account, accessToken, channel, scope, lastError, deadline } =
    options;
  /* La liste des publications garde ses soixante jours dans les deux portées,
     et ce n'est pas une négligence : un commentaire arrive aujourd'hui sous un
     reel d'il y a six semaines. Ce que la portée « jour » raccourcit, ce n'est
     pas la liste — Meta la rend en un ou deux appels — c'est ce qu'on
     **descend** derrière, tranché par les curseurs. */
  const since = sinceDate();
  /* Les conversations, elles, se bornent vraiment : deux jours à l'ouverture
     de l'écran, soixante la nuit. */
  const conversationsSince = conversationSince(scope, new Date());
  const threads: IngestedThread[] = [];

  const withAuthors = async (collected: IngestedThread[]) => {
    // Un appel par fil orphelin : c'est le rattrapage de la nuit, pas ce
    // qu'on fait attendre à quelqu'un qui vient d'ouvrir son inbox.
    if (!backfillsProfiles(scope)) return collected;

    // Les fils dont Meta n'a pas nommé l'auteur : un appel direct sur le
    // commentaire le rend parfois. Ceux qu'il ne rend toujours pas sont
    // masqués par Meta, et l'écran le dira.
    const orphans = collected.filter(
      // Un message privé nomme toujours son interlocuteur, et son identifiant
      // de fil n'est pas celui d'un commentaire : l'appel échouerait.
      (thread) => thread.kind === "comment" && !thread.participantHandle,
    );
    if (orphans.length === 0) return collected;

    const recovered = await fetchCommentAuthors({
      ids: orphans.map((thread) => thread.externalThreadId),
      accessToken,
    });
    for (const thread of orphans) {
      const author = recovered.get(thread.externalThreadId);
      if (!author) continue;
      thread.participantHandle = author.handle;
      thread.participantExternalId =
        thread.participantExternalId ?? author.externalId;
    }
    return collected;
  };

  /**
   * Les messages privés, quand la Page est connue.
   *
   * Toujours via la Page, Instagram compris : la messagerie d'un compte
   * professionnel passe par elle. Pour un compte Instagram, c'est
   * `parent_external_id` qui la porte — sans elle, il n'y a pas de boîte à
   * relever, et ce n'est pas une erreur.
   *
   * Un refus ici ne fait pas tomber les commentaires : les portées de la
   * messagerie sont distinctes, et une boîte privée fermée ne doit pas priver
   * le client de ses commentaires.
   */
  /**
   * YouTube : les commentaires de la chaîne, toutes vidéos confondues.
   *
   * Pas de messagerie privée — YouTube n'en a pas —, et pas de rattrapage
   * d'auteur : l'API nomme toujours l'auteur d'un commentaire public.
   */
  if (channel === "youtube") {
    const collected = await fetchChannelCommentThreads({
      channelId: account.external_id,
      accessToken,
      since,
    });
    const videos = await fetchVideos({
      ids: videoIdsOf(collected),
      accessToken,
    });
    return {
      threads: threadsToConversations({
        threads: collected,
        videos,
        brandChannelId: account.external_id,
      }),
      warning: null,
      directMessagesMs: 0,
    };
  }

  const pullDirectMessages = async (): Promise<{
    threads: IngestedThread[];
    warning: string | null;
  }> => {
    const pageId =
      channel === "instagram" ? account.parent_external_id : account.external_id;
    if (!pageId) {
      return {
        threads: [],
        warning:
          "Aucune Page rattachée à ce compte Instagram : la messagerie privée passe par elle. Rebrancher Meta depuis Connexions.",
      };
    }

    /* La mémoire du refus. Une boîte refusée jusqu'au minimum au passage
       précédent ne se retente pas à l'ouverture de l'écran : 45 s pour le
       même refus, dans une route qui n'en a que soixante. L'avertissement
       reste écrit — il n'a pas été redemandé, il n'a pas disparu — et c'est
       le passage complet qui retente. */
    if (!shouldPullDirectMessages({ scope, lastError })) {
      return { threads: [], warning: dmUnavailableWarning(channel) };
    }

    /* Le budget de la boîte, borné deux fois : `DM_BUDGET_MS` de bout en
       bout, et l'échéance de l'appelant quand il en a une. Chaque appel
       reçoit ce qui reste — jamais plus que les 45 s du transport — et rien
       ne part sous `DM_MIN_CALL_MS`. */
    const dmStartedAt = Date.now();
    const dmDeadline = Math.min(
      dmStartedAt + DM_BUDGET_MS,
      deadline ?? Number.POSITIVE_INFINITY,
    );
    const remaining = () => Math.min(GRAPH_TIMEOUT_MS, dmDeadline - Date.now());
    const canCall = () => remaining() >= DM_MIN_CALL_MS;

    try {
      /* Le même escalier de volume que partout, mais **budgété** : chaque
         palier coûte au plus un appel — aucun délai dépassé ne se rejoue —
         et la portée dit combien de paliers on descend. Ce refus, rangé en
         avertissement, s'affichait autrefois comme « canal en erreur » alors
         que les commentaires passaient.

         Le palier de **départ** vient de la mémoire : une boîte que Meta ne
         sert qu'aux en-têtes (la Page Bondet) démarre là le jour, où un
         seul palier est permis — sinon elle échouait sur le listing
         développé, se déclarait refusée, et n'était plus relue qu'à la nuit. */
      const platform = channel === "instagram" ? "instagram" : "messenger";
      const start = startsAtHeaders({ scope, lastError })
        ? DIRECT_MESSAGE_LADDER.findIndex((step) => step.kind === "headers")
        : 0;
      const steps = DIRECT_MESSAGE_LADDER.slice(
        start,
        start + directMessageStepBudget(scope),
      );
      let conversations: MetaConversationRow[] | null = null;
      let headers: MetaConversationRow[] | null = null;
      let deferred = false;
      for (const step of steps) {
        if (!canCall()) {
          deferred = true;
          break;
        }
        try {
          if (step.kind === "conversations") {
            conversations = await fetchConversations({
              pageId,
              accessToken,
              platform,
              since: conversationsSince,
              pageSize: step.pageSize,
              messageLimit: step.messageLimit,
              withAttachments: step.withAttachments,
              timeoutMs: remaining(),
            });
          } else {
            headers = await fetchConversationHeaders({
              pageId,
              accessToken,
              platform,
              since: conversationsSince,
              pageSize: step.pageSize,
              withParticipants: step.withParticipants,
              timeoutMs: remaining(),
            });
          }
          break;
        } catch (error) {
          if (!shouldStepDown(error)) throw error;
        }
      }
      if (!conversations && !headers) {
        /* Rien demandé faute de temps : rien appris, la boîte est reportée
           et le relevé suivant la redemande. Sinon, Meta refuse jusqu'au
           dernier palier du budget : il n'y a plus rien à découper ce
           passage. La boîte se dit indisponible en clair — les commentaires
           du canal, eux, sont passés — et ce texte est ce que le relevé du
           jour relira pour ne pas retenter. */
        if (deferred) return { threads: [], warning: DM_DEFERRED_WARNING };
        return { threads: [], warning: dmUnavailableWarning(channel) };
      }
      let headersNote: string | null = null;
      if (!conversations && headers) {
        /* Le schéma des commentaires — en-têtes minuscules, puis les messages
           fil par fil, chaque appel de taille bornée — vécu sur la boîte de
           la Page Bondet, où même 10 fils × 5 messages sans pièces jointes
           débordaient. Borné dans le temps avant **chaque** appel, repli
           compris : ce qui n'est pas relu attend le passage suivant. La note
           écrite en base fait démarrer le relevé du jour ici directement. */
        headersNote = dmHeadersOnlyNote();
        const recent = headers
          .filter(
            (header) =>
              !header.updated_time ||
              header.updated_time.slice(0, 10) >= conversationsSince,
          )
          .slice(0, DM_HEADERS_CAP);
        conversations = [];
        for (const header of recent) {
          if (!canCall()) break;
          let messages: { data?: unknown[] } = {};
          try {
            messages = await fetchConversationMessages({
              conversationId: header.id,
              accessToken,
              timeoutMs: remaining(),
            });
          } catch (error) {
            if (!shouldStepDown(error)) throw error;
            if (canCall()) {
              messages = await fetchConversationMessages({
                conversationId: header.id,
                accessToken,
                limit: 3,
                withAttachments: false,
                timeoutMs: remaining(),
              }).catch(() => ({}));
            }
          }
          // Le palier nu du listing a laissé les participants : sans eux, le
          // fil n'a pas d'interlocuteur — ils se redemandent fil par fil.
          const participants =
            header.participants ??
            (canCall()
              ? await fetchConversationParticipants({
                  conversationId: header.id,
                  accessToken,
                  timeoutMs: remaining(),
                }).catch(() => undefined)
              : undefined);
          conversations.push({
            ...header,
            participants,
            messages: messages as MetaConversationRow["messages"],
          });
        }
      }
      const dmThreads = conversationsToThreads({
        conversations: conversations ?? [],
        channel,
        // Les deux identités de la marque : Meta nomme l'expéditeur par la
        // Page sur Messenger, par le compte Instagram sur Instagram.
        brandIds: [pageId, account.external_id],
      });

      /* La photo de profil de l'interlocuteur : le listing ne la rend pas,
         l'API de profil oui — plafonnée par passage, en meilleur effort.
         L'upsert préserve les photos déjà posées, donc chaque passage n'a à
         demander que les nouvelles têtes. */
      /* Uniquement la nuit, et uniquement les têtes qu'on n'a pas déjà. Deux
         défauts distincts réparés ici : ce rattrapage coûte jusqu'à cinquante
         appels un par un — hors de question de le faire attendre à qui ouvre
         son écran — et il redemandait **les mêmes personnes** à chaque
         passage, `conversationToThread` posant toujours `null` et la collecte
         ne relisant jamais la base. */
      const known = backfillsProfiles(scope)
        ? await avatarsAlreadyKnown({ admin, clientId, channel })
        : null;
      const missing = known
        ? [
            ...new Set(
              dmThreads
                .filter((thread) => !thread.participantAvatarUrl)
                .map((thread) => thread.participantExternalId)
                .filter((id): id is string => Boolean(id)),
            ),
          ]
            .filter((id) => !known.has(id))
            .slice(0, AVATAR_BACKFILL_CAP)
        : [];
      let avatarWarning: string | null = null;
      if (missing.length > 0) {
        const { profiles, failure } = await fetchMessagingProfiles({
          ids: missing,
          accessToken,
        });
        for (const thread of dmThreads) {
          if (thread.participantAvatarUrl || !thread.participantExternalId) continue;
          thread.participantAvatarUrl =
            profiles.get(thread.participantExternalId) ?? null;
        }
        if (failure) {
          /* Constaté en production : Meta ne sert le profil (photo comprise)
             que pour les contacts d'une conversation **récente** — refus
             « does not exist / missing permissions » sur les anciens fils —
             et le refuse en bloc (#3) sans App Review. Ces deux limites sont
             **structurelles** : les initiales font foi, et un état permanent
             de « canal en erreur » pour ça masquerait les vraies pannes. On
             ne remonte donc que les refus inattendus. */
          const structural =
            failure.includes("does not exist") ||
            failure.includes("Unsupported get request") ||
            failure.includes("(#3)") ||
            failure.includes("does not have the capability");
          avatarWarning = structural
            ? null
            : `Photos de profil refusées par Meta : ${failure}`;
        }
      }

      /* Deux notes peuvent cohabiter ; c'est le préfixe de chacune que le
         passage suivant relit, pas sa position. */
      const warning = [headersNote, avatarWarning].filter(Boolean).join(" ");
      return { threads: dmThreads, warning: warning || null };
    } catch (error) {
      return {
        threads: [],
        warning: explainMetaError((error as Error).message).message,
      };
    }
  };

  if (channel === "instagram") {
    /* Le listing des médias, en repli de fenêtre sur le refus de volume de
       Meta — et sur lui seul : redemander plus petit devant un jeton expiré
       multiplierait les appels pour le même refus. */
    /* La fenêtre seule ne suffit pas : elle ne réduit pas la **première
       page** — 50 médias aux captions longues débordent quel que soit le
       `since`, et Bondet est resté en erreur trois paliers de suite. Les
       derniers échelons réduisent donc la page à 10, puis lâchent la caption
       (le champ gras — l'extrait de publication vaut moins qu'un canal mort). */
    const ladders = [
      ...[POSTS_WINDOW_DAYS, ...FALLBACK_WINDOW_DAYS].map((days) => ({ days })),
      { days: FALLBACK_WINDOW_DAYS.at(-1)!, pageSize: 10 },
      { days: FALLBACK_WINDOW_DAYS.at(-1)!, pageSize: 10, withCaption: false },
    ];
    let media = null;
    for (const [index, step] of ladders.entries()) {
      const windowSince = new Date();
      windowSince.setUTCDate(windowSince.getUTCDate() - step.days);
      try {
        media = await fetchInstagramMediaLite({
          igUserId: account.external_id,
          accessToken,
          since: windowSince.toISOString().slice(0, 10),
          ...("pageSize" in step ? { pageSize: step.pageSize } : {}),
          ...("withCaption" in step ? { withCaption: step.withCaption } : {}),
        });
        break;
      } catch (error) {
        if (!isTooMuchData(error) || index === ladders.length - 1) {
          throw error;
        }
      }
    }
    const brand = { externalId: account.external_id, username: account.username };

    /* L'échelle des replis d'un média trop lourd, du plein régime au strict
       minimum : pages de 50 avec réponses, pages de 10, puis pages de 10
       **sans l'expansion `replies`** — c'est elle qui pèse. Et si le dernier
       palier refuse encore, le média est passé avec un avertissement nommé :
       un seul reel viral ne doit plus faire tomber le canal entier — c'est
       exactement ce qui laissait Bondet à « demande trop lourde ». */
    /* Le curseur de chaque publication : Meta rend `comments_count` gratuitement
       dans ce listing, et c'est lui qui dit ce qui a bougé. En portée « jour »,
       une publication dont le compteur n'a pas changé ne coûte plus un appel —
       c'est ce qui rend le relevé court **sans** raccourcir la fenêtre, donc
       sans manquer le commentaire posé aujourd'hui sous un reel d'il y a six
       semaines. La nuit, tout redescend et les curseurs sont simplement remis
       à jour. */
    const cursors = usesPostCursors(scope)
      ? await loadPostCursors({ admin, clientId, channel })
      : null;
    const seen = new Map<string, number>();

    let skippedMedia = 0;
    for (const item of media ?? []) {
      // Une story ne reçoit pas de commentaires ; zéro commentaire, zéro appel.
      if (item.media_product_type === "STORY") continue;
      const commentsCount = item.comments_count ?? 0;
      if (!commentsCount) continue;
      if (cursors?.get(item.id) === commentsCount) continue;
      let comments = null;
      for (const attempt of [
        {},
        { limit: 10 },
        { limit: 10, includeReplies: false },
      ] as const) {
        try {
          comments = await fetchInstagramComments({
            mediaId: item.id,
            accessToken,
            ...attempt,
          });
          break;
        } catch (error) {
          if (!isTooMuchData(error)) throw error;
        }
      }
      if (!comments) {
        skippedMedia += 1;
        continue;
      }
      threads.push(...igCommentsToThreads({ media: item, comments, brand }));
      // Après la descente, jamais avant : une publication refusée doit être
      // retentée au passage suivant, pas classée comme vue.
      seen.set(item.id, commentsCount);
    }
    await savePostCursors({ admin, clientId, channel, seen });

    const volumeWarning =
      skippedMedia > 0
        ? `${skippedMedia} publication(s) trop commentée(s) pour Meta : leurs commentaires n'ont pas pu être relevés ce passage.`
        : null;

    const directStartedAt = Date.now();
    const direct = await pullDirectMessages();
    const directMessagesMs = Date.now() - directStartedAt;
    threads.push(...direct.threads);
    return {
      threads: await withAuthors(threads),
      warning: [volumeWarning, direct.warning].filter(Boolean).join(" ") || null,
      directMessagesMs,
    };
  }

  const posts = await fetchPagePostsLite({
    pageId: account.external_id,
    accessToken,
    since: unixSince(since),
  });
  const brand = { externalId: account.external_id };

  const pageCursors = usesPostCursors(scope)
    ? await loadPostCursors({ admin, clientId, channel })
    : null;
  const pageSeen = new Map<string, number>();

  for (const post of posts) {
    const commentsCount = post.comments?.summary?.total_count ?? 0;
    if (!commentsCount) continue;
    if (pageCursors?.get(post.id) === commentsCount) continue;
    const comments = await fetchPageComments({ postId: post.id, accessToken });
    threads.push(...pageCommentsToThreads({ post, comments, brand }));
    pageSeen.set(post.id, commentsCount);
  }
  await savePostCursors({ admin, clientId, channel, seen: pageSeen });

  const directStartedAt = Date.now();
  const direct = await pullDirectMessages();
  const directMessagesMs = Date.now() - directStartedAt;
  threads.push(...direct.threads);
  return {
    threads: await withAuthors(threads),
    warning: direct.warning,
    directMessagesMs,
  };
}

export async function syncModerationInbox(options: {
  admin: Admin;
  /**
   * Ce que le passage redemande. `complet` par défaut — un appel qui ne dit
   * rien veut le comportement d'avant, et c'est la portée du matin.
   */
  scope?: SyncScope;
  /**
   * L'instant (ms epoch) au-delà duquel l'appelant sera coupé. La route
   * Vercel le pose ; le script GitHub ne le pose pas. Chaque canal en tient
   * compte dans sa boîte privée, et un canal entamé après l'échéance est
   * reporté sans rien écrire — mieux qu'une coupure au milieu de son journal.
   */
  deadline?: number;
}): Promise<ModerationSyncReport[]> {
  const { admin, deadline } = options;
  const scope: SyncScope = options.scope ?? "complet";
  const reports: ModerationSyncReport[] = [];

  const { data: links, error: linksError } = await admin
    .from("workspace_social_accounts")
    .select("workspace_id, kind, account_id")
    .in("kind", ["instagram", "facebook_page", "youtube"]);
  if (linksError) fail(`Lecture des affectations : ${linksError.message}`);

  const linkRows = (links ?? []) as unknown as {
    workspace_id: string;
    kind: "instagram" | "facebook_page" | "youtube";
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

    const channel: "instagram" | "facebook" | "youtube" =
      link.kind === "instagram"
        ? "instagram"
        : link.kind === "youtube"
          ? "youtube"
          : "facebook";
    const report: ModerationSyncReport = {
      workspace: workspace.name,
      channel,
      account: link.account_id,
      threads: 0,
      error: null,
      elapsedMs: 0,
      directMessagesMs: 0,
    };
    reports.push(report);
    const startedAt = Date.now();

    if (deadline !== undefined && startedAt >= deadline) {
      report.messagesWarning = CHANNEL_DEFERRED_WARNING;
      continue;
    }

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
      /* Deux formats de jeton, deux durées de vie : Meta rend une chaîne qui
         vit deux mois, Google un JSON dont l'accès expire dans l'heure et se
         renouvelle. Le rafraîchissement est réécrit tout de suite — sinon
         chaque passage en redemanderait un. */
      let accessToken: string;
      if (link.kind === "youtube") {
        const usable = await usableAccessToken(blob);
        accessToken = usable.accessToken;
        if (usable.refreshed) {
          const { error: refreshError } = await admin
            .from("social_account_secrets")
            .update({
              credentials_encrypted: usable.refreshed,
              updated_at: new Date().toISOString(),
            } as never)
            .eq("account_id", link.account_id);
          if (refreshError) fail(`Jeton rafraîchi : ${refreshError.message}`);
        }
      } else {
        accessToken = decryptSecret(blob);
      }

      // Le journal de passage du canal : une ligne par (client, canal,
      // compte), le même rôle que `data_sources` au Reporting. L'upsert ne
      // touche pas `last_error` : on relit celui du passage précédent, c'est
      // la mémoire d'une boîte privée refusée (`dm-availability.ts`).
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
        .select("id, last_error")
        .single();
      if (connectionError) fail(`Connexion du canal : ${connectionError.message}`);
      const { id: connectionId, last_error: lastError } =
        connection as unknown as { id: string; last_error: string | null };

      try {
        const pulled = await pullThreads({
          admin,
          clientId: client.id,
          account,
          accessToken,
          channel,
          scope,
          lastError,
          deadline,
        });
        report.messagesWarning = pulled.warning;
        report.directMessagesMs = pulled.directMessagesMs;
        report.threads = await upsertThreads({
          admin,
          client,
          connectionId,
          channel,
          threads: pulled.threads,
        });

        const { error: doneError } = await admin
          .from("channel_connections")
          .update({
            /* Le passage a abouti : `status` reste `connected`, et c'est lui
               qui fait foi à l'écran. `last_error` porte alors un
               **avertissement** — une portée refusée sur la messagerie, par
               exemple — et non une panne : l'inbox lisait ce seul champ et
               affichait « canal en erreur » à la place de l'âge du relevé,
               donnant à une boîte à jour l'air d'une panne. */
            status: "connected",
            last_polled_at: new Date().toISOString(),
            last_error: pulled.warning,
          } as never)
          .eq("id", connectionId);
        if (doneError) fail(`Clôture du passage : ${doneError.message}`);
      } catch (error) {
        const raw = (error as Error).message;
        const message =
          link.kind === "youtube"
            ? explainYouTubeError(raw).message
            : explainMetaError(raw).message;
        await admin
          .from("channel_connections")
          .update({ status: "error", last_error: message } as never)
          .eq("id", connectionId);
        throw error;
      }
    } catch (error) {
      const raw = (error as Error).message;
      report.error =
        link.kind === "youtube"
          ? explainYouTubeError(raw).message
          : explainMetaError(raw).message;
    } finally {
      report.elapsedMs = Date.now() - startedAt;
    }
  }

  return reports;
}

// --- Indexation sémantique de la FAQ -----------------------------------------

/** Bornent un passage — le suivant reprend ce qui dépasse. */
const REINDEX_BATCH = 100;
const EMBED_CHUNK = 16;

export type FaqReindexReport = {
  /** Entrées sans vecteur, sans source, ou vectorisées par un autre fournisseur. */
  pending: number;
  indexed: number;
  /** Le modèle n'a pas pu tourner ici — le passage du matin s'en chargera. */
  note: string | null;
};

/**
 * Indexe les entrées FAQ en attente de vecteur.
 *
 * Les corrections n'embarquent plus le modèle dans le clic : 25 Mo à charger,
 * et son binaire ONNX ne charge pas sur Vercel — l'échec emportait la réponse
 * avec lui. Les entrées s'écrivent donc sans vecteur, et ce passage — greffé
 * au passage du matin, qui tourne sur une machine complète — les indexe. Il fait
 * aussi converger les vecteurs d'un autre fournisseur (la démonstration a été
 * amorcée en `deterministic`) : deux sources ne se comparent pas.
 *
 * L'indisponibilité du modèle n'est **pas** une erreur — c'est le cas normal
 * du bouton « Relever maintenant », qui tourne sur Vercel : rien n'est perdu,
 * l'attente est dite. Une erreur Supabase, elle, échoue franchement.
 */
export async function reindexFaqSearch(options: {
  admin: Admin;
}): Promise<FaqReindexReport> {
  const { admin } = options;
  const provider = getEmbeddingProvider();

  const { data, error } = await admin
    .from("faq_entries")
    .select("id, question_canonical, variants")
    .is("deleted_at", null)
    .or(pendingEmbeddingFilter(provider.id))
    .limit(REINDEX_BATCH);
  if (error) fail(`Lecture des entrées FAQ à indexer : ${error.message}`);

  const rows = (data ?? []) as unknown as {
    id: string;
    question_canonical: string;
    variants: string[];
  }[];
  if (rows.length === 0) return { pending: 0, indexed: 0, note: null };

  const vectors: number[][] = [];
  try {
    for (let start = 0; start < rows.length; start += EMBED_CHUNK) {
      const batch = rows.slice(start, start + EMBED_CHUNK);
      vectors.push(
        ...(await provider.embedMany(batch.map((row) => faqEmbeddingText(row)))),
      );
    }
  } catch (error) {
    return { pending: rows.length, indexed: 0, note: (error as Error).message };
  }

  for (const [index, row] of rows.entries()) {
    const { error: writeError } = await admin
      .from("faq_entries")
      .update({
        embedding: toPgVector(vectors[index]!),
        embedding_source: provider.id,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", row.id);
    if (writeError) fail(`Écriture d'un vecteur FAQ : ${writeError.message}`);
  }

  return { pending: rows.length, indexed: rows.length, note: null };
}
