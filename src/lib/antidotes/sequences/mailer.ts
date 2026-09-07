import "server-only";

import { getGmailTransport } from "@/lib/planning/notify";
import { getMessageMeta, getThreadMessages, sendMessage } from "@/lib/recus/gmail";
import type { Mailer } from "./passage";

/**
 * La boîte Gmail des Reçus, vue par le passage des séquences — le transport
 * de tout courriel sortant du produit. Un email de prospection part donc de
 * l'adresse de l'agence, celle à laquelle on répond, et c'est ce fil qu'on
 * relit pour voir la réponse.
 *
 * `null` quand aucune boîte n'est connectée : le passage le dit, il ne
 * plante pas.
 */
export async function createGmailMailer(): Promise<
  { ok: true; mailer: Mailer } | { ok: false; reason: string }
> {
  const gmail = await getGmailTransport();
  if (!gmail.ok) return { ok: false, reason: gmail.reason };
  const { accessToken, from } = gmail.transport;

  return {
    ok: true,
    mailer: {
      ownAddress: from,
      async send({ mime, threadId }) {
        const id = await sendMessage({ accessToken, mime, threadId: threadId ?? undefined });
        // `messages.send` ne rend que l'identifiant : le fil se relit ensuite,
        // et c'est lui que le relevé des réponses parcourra.
        const meta = await getMessageMeta(accessToken, id);
        return { id, threadId: meta.threadId };
      },
      async readThread(threadId) {
        return getThreadMessages(accessToken, threadId);
      },
    },
  };
}
