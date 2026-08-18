import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  replyToInstagramComment,
  replyToPageComment,
  sendDirectMessage,
} from "@/lib/connectors/meta/graph";
import { evaluateSendEligibility } from "./response-window";
import type { Database } from "@/lib/supabase/database.types";
import { decryptSecret } from "./crypto";
import type { Conversation } from "./types";

/**
 * L'envoi réel d'une réponse validée.
 *
 Une réponse à un fil de commentaires part **sous le commentaire de tête** :
 * Instagram n'accepte de toute façon les réponses qu'à ce niveau, et Facebook
 * y gagne un fil lisible.
 *
 * Un message privé part par la messagerie de la Page — Instagram compris, sa
 * boîte passant par elle — et à l'adresse de **la personne**, pas de la
 * conversation. La fenêtre de 24 h de Meta s'applique : au-delà, le tag
 * `human_agent` l'étend à 7 jours, ce qui est précisément son objet.
 *
 * Le jeton se lit avec le client admin : les secrets sont owner-only par RLS,
 * et c'est voulu — un opérateur ne lit jamais un jeton, il déclenche un envoi
 * que le serveur exécute après la garde `requireOperator`.
 */

type Admin = SupabaseClient<Database>;

export type SendOutcome =
  | { sent: true; externalMessageId: string }
  | {
      /** Rien n'est parti, et ce n'est pas une panne : le canal n'est pas
          branché pour l'envoi. La raison s'affiche telle quelle. */
      sent: false;
      reason: string;
    };

function fail(message: string): never {
  throw new Error(message);
}

export async function sendReply(options: {
  admin: Admin;
  conversation: Conversation;
  body: string;
}): Promise<SendOutcome> {
  const { admin, conversation, body } = options;

  if (conversation.channel !== "instagram" && conversation.channel !== "facebook") {
    return {
      sent: false,
      reason: "L'envoi réel n'est branché que pour Instagram et Facebook.",
    };
  }
  if (conversation.kind !== "comment" && conversation.kind !== "dm") {
    return {
      sent: false,
      reason: "Ce type de conversation ne se répond pas encore depuis l'outil.",
    };
  }

  if (!conversation.connection_id) {
    return {
      sent: false,
      reason:
        "Cette conversation n'est reliée à aucun canal connecté — lancer une synchronisation d'abord.",
    };
  }

  const { data: connection, error: connectionError } = await admin
    .from("channel_connections")
    .select("external_account_id")
    .eq("id", conversation.connection_id)
    .maybeSingle();
  if (connectionError) fail(`Connexion du canal : ${connectionError.message}`);
  const externalAccountId = (
    connection as { external_account_id?: string } | null
  )?.external_account_id;
  if (!externalAccountId) {
    return {
      sent: false,
      reason: "La connexion du canal a disparu — lancer une synchronisation d'abord.",
    };
  }

  const { data: client, error: clientError } = await admin
    .from("moderation_clients")
    .select("org_id")
    .eq("id", conversation.client_id)
    .maybeSingle();
  if (clientError) fail(`Client de modération : ${clientError.message}`);
  const orgId = (client as { org_id?: string } | null)?.org_id;
  if (!orgId) fail("Client de modération introuvable.");

  const kind = conversation.channel === "instagram" ? "instagram" : "facebook_page";
  const { data: account, error: accountError } = await admin
    .from("social_accounts")
    .select("id")
    .eq("org_id", orgId)
    .eq("kind", kind)
    .eq("external_id", externalAccountId)
    .maybeSingle();
  if (accountError) fail(`Compte social : ${accountError.message}`);
  const accountId = (account as { id?: string } | null)?.id;
  if (!accountId) {
    return {
      sent: false,
      reason:
        "Le compte social de cette conversation n'est plus dans l'inventaire — rebrancher Meta depuis Connexions.",
    };
  }

  const { data: secret, error: secretError } = await admin
    .from("social_account_secrets")
    .select("credentials_encrypted")
    .eq("account_id", accountId)
    .maybeSingle();
  if (secretError) fail(`Lecture du jeton : ${secretError.message}`);
  const blob = (secret as { credentials_encrypted?: string } | null)
    ?.credentials_encrypted;
  if (!blob) {
    return {
      sent: false,
      reason: "Aucun jeton enregistré — rebrancher Meta depuis Connexions.",
    };
  }

  const accessToken = decryptSecret(blob);

  if (conversation.kind === "dm") {
    if (!conversation.participant_external_id) {
      return {
        sent: false,
        reason:
          "Meta n'a pas rendu l'identifiant de l'interlocuteur : impossible de lui écrire. Relancer une synchronisation.",
      };
    }

    // La messagerie passe par la Page, Instagram compris.
    const { data: accountRow, error: accountRowError } = await admin
      .from("social_accounts")
      .select("parent_external_id")
      .eq("id", accountId)
      .maybeSingle();
    if (accountRowError) fail(`Compte social : ${accountRowError.message}`);
    const pageId =
      conversation.channel === "instagram"
        ? ((accountRow as { parent_external_id?: string | null } | null)
            ?.parent_external_id ?? null)
        : externalAccountId;
    if (!pageId) {
      return {
        sent: false,
        reason:
          "Aucune Page rattachée à ce compte Instagram : la messagerie passe par elle. Rebrancher Meta depuis Connexions.",
      };
    }

    /* Au-delà de 24 h, Meta refuse l'envoi sans le tag `human_agent` — prévu
       pour un opérateur qui répond en différé. On le pose seulement quand la
       fenêtre standard est passée : le poser toujours reviendrait à déclarer
       une intervention humaine là où une réponse immédiate suffit. */
    const eligibility = evaluateSendEligibility({
      channel: conversation.channel,
      kind: conversation.kind,
      lastInboundAt: new Date(conversation.last_message_at),
    });

    const outcome = await sendDirectMessage({
      pageId,
      recipientId: conversation.participant_external_id,
      message: body,
      accessToken,
      humanAgentTag: eligibility.canSend && eligibility.requiresHumanAgentTag,
    });

    return {
      sent: true,
      externalMessageId: outcome.message_id ?? outcome.id ?? conversation.id,
    };
  }

  const commentId = conversation.external_thread_id;
  const result =
    conversation.channel === "instagram"
      ? await replyToInstagramComment({ commentId, message: body, accessToken })
      : await replyToPageComment({ commentId, message: body, accessToken });

  return { sent: true, externalMessageId: result.id };
}
