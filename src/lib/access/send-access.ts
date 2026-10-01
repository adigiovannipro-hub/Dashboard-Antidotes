import "server-only";

import { getGmailTransport } from "@/lib/planning/notify";
import { sendMessage } from "@/lib/recus/gmail";
import { createAdminClient } from "@/lib/supabase/server";
import { accessLink, buildAccessMime, type AccessEmailKind } from "./access-email";

/**
 * L'envoi d'un lien d'accès — invitation à un espace ou lien de connexion.
 *
 * Même mécanique que le courriel d'arrivée de l'Academy (`sendCourseOnboarding`),
 * qui a fait ses preuves sur de vraies élèves :
 *
 * 1. **Fabriquer le lien.** `auth.admin.generateLink` crée le compte s'il
 *    n'existe pas (`invite`) — le trigger `app.handle_new_user` change alors
 *    l'invitation en accès — ou rend un lien de connexion (`magiclink`) pour
 *    un compte existant. Rien ne passe par la boîte d'envoi de Supabase, qui
 *    ne délivre qu'aux membres de l'équipe du projet.
 *
 * 2. **Poster le message par la boîte Gmail des Reçus**, le transport de tout
 *    courriel sortant du produit : il part de l'adresse de l'agence, celle à
 *    laquelle un client peut répondre.
 *
 * Boîte déconnectée, rien n'échoue : le lien est rendu, à copier et envoyer à
 * la main.
 */

export type AccessSendResult =
  | { ok: true; sent: boolean; link: string; reason: string | null }
  | { ok: false; error: string };

export const ACCESS_SENDER_NAME = "Alessandro";

export async function sendAccessLink(options: {
  kind: AccessEmailKind;
  email: string;
  firstName: string | null;
  workspaceName: string | null;
  /** Chemin interne d'arrivée, `/espace/anmf` pour une invitation. */
  destination: string;
  siteUrl: string;
}): Promise<AccessSendResult> {
  const admin = createAdminClient();

  // `invite` sur un compte qui existe déjà répond « User already registered » :
  // on tente l'invitation, puis on retombe sur le lien de connexion simple.
  // L'ordre compte — `magiclink` sur une adresse inconnue échoue de son côté.
  let generated = await admin.auth.admin.generateLink({
    type: "invite",
    email: options.email,
  });
  let type = "invite";

  if (generated.error) {
    generated = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: options.email,
    });
    type = "magiclink";
  }

  if (generated.error || !generated.data.properties?.hashed_token) {
    return {
      ok: false,
      error: generated.error?.message ?? "Impossible de fabriquer le lien d'accès.",
    };
  }

  const site = options.siteUrl.replace(/\/+$/, "");
  const link = accessLink({
    siteUrl: site,
    tokenHash: generated.data.properties.hashed_token,
    type,
    destination: options.destination,
  });

  const gmail = await getGmailTransport();
  if (!gmail.ok) {
    console.error(`[acces] courriel non envoyé : ${gmail.reason}`);
    return { ok: true, sent: false, link, reason: gmail.reason };
  }

  try {
    await sendMessage({
      accessToken: gmail.transport.accessToken,
      mime: buildAccessMime({
        kind: options.kind,
        from: gmail.transport.from,
        to: options.email,
        firstName: options.firstName,
        workspaceName: options.workspaceName,
        link,
        loginUrl: `${site}/login`,
        senderName: ACCESS_SENDER_NAME,
      }),
    });
  } catch (error) {
    const reason = `Envoi refusé par Gmail : ${(error as Error).message}`;
    console.error(`[acces] ${reason}`);
    return { ok: true, sent: false, link, reason };
  }

  return { ok: true, sent: true, link, reason: null };
}
