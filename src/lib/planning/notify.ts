import "server-only";

import { decryptSecret, encryptSecret } from "@/lib/moderation/crypto";
import { refreshAccessToken, sendMessage } from "@/lib/recus/gmail";
import type { ReceiptSource } from "@/lib/recus/types";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { buildCommentMime } from "./notify-mime";

/**
 * L'envoi d'un retour par e-mail, aux adresses taguées dans le fil.
 *
 * Le transport est la boîte Gmail déjà connectée aux Reçus — la seule du
 * projet, et celle de l'agence : le retour part de l'adresse que le client
 * connaît. Le client admin ne sert ici qu'à lire ce jeton, qui vit dans une
 * table interne (`receipt_sources`) hors de portée des politiques d'un espace
 * client ; qui peut taguer est décidé en amont, par la RLS de
 * `planning_comments`.
 *
 * Aucun échec ne remonte en exception : le retour est déjà écrit quand on
 * arrive ici, et perdre un e-mail ne doit jamais perdre le retour.
 */

export type CommentNotification = {
  recipients: string[];
  workspaceSlug: string;
  workspaceName: string;
  boardSlug: string;
  subjectId: string;
  subjectName: string;
  laneName: string;
  authorName: string;
  body: string;
};

export type NotifyOutcome = {
  sent: string[];
  failed: string[];
  /** Renseigné quand rien n'est parti — de quoi afficher un message utile. */
  reason?: string;
};

/** La boîte d'envoi prête à l'emploi : jeton frais et adresse d'expédition. */
export type GmailTransport = { accessToken: string; from: string };

/**
 * La boîte Gmail des Reçus, jeton rafraîchi — le transport de tout courriel
 * sortant du produit : retours du planning, envoi en validation.
 */
export async function getGmailTransport(): Promise<
  { ok: true; transport: GmailTransport } | { ok: false; reason: string }
> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("receipt_sources")
    .select("*")
    .eq("status", "connected")
    .limit(1)
    .maybeSingle();

  const source = data as unknown as ReceiptSource | null;
  if (!source?.credentials_encrypted) {
    return { ok: false, reason: "Aucune boîte Gmail connectée — voir le panneau Reçus." };
  }

  try {
    const refreshToken = decryptSecret(source.credentials_encrypted);
    const tokens = await refreshAccessToken(refreshToken);
    // Google ne renvoie pas toujours un refresh token : on ne remplace le
    // stocké que s'il en arrive un — même règle que le pipeline des Reçus.
    if (tokens.refreshToken && tokens.refreshToken !== refreshToken) {
      await admin
        .from("receipt_sources")
        .update({ credentials_encrypted: encryptSecret(tokens.refreshToken) })
        .eq("id", source.id);
    }
    return {
      ok: true,
      transport: { accessToken: tokens.accessToken, from: source.email_address },
    };
  } catch (error) {
    return { ok: false, reason: `Connexion Gmail refusée : ${(error as Error).message}` };
  }
}

export async function sendCommentEmails(
  notification: CommentNotification,
): Promise<NotifyOutcome> {
  const gmail = await getGmailTransport();
  if (!gmail.ok) {
    return { sent: [], failed: notification.recipients, reason: gmail.reason };
  }
  const { accessToken, from } = gmail.transport;

  const link = `${publicEnv.NEXT_PUBLIC_SITE_URL}/espace/${notification.workspaceSlug}/planning/${notification.boardSlug}?sujet=${notification.subjectId}`;

  const sent: string[] = [];
  const failed: string[] = [];
  let lastError: string | undefined;

  for (const recipient of notification.recipients) {
    try {
      await sendMessage({
        accessToken,
        mime: buildCommentMime({
          from,
          to: recipient,
          workspaceName: notification.workspaceName,
          subjectName: notification.subjectName,
          laneName: notification.laneName,
          authorName: notification.authorName,
          body: notification.body,
          link,
        }),
      });
      sent.push(recipient);
    } catch (error) {
      failed.push(recipient);
      lastError = (error as Error).message;
    }
  }

  return {
    sent,
    failed,
    reason: sent.length === 0 ? lastError : undefined,
  };
}
