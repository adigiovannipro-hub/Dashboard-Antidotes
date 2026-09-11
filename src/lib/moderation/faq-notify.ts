import "server-only";

import { publicEnv } from "@/lib/env";
import { getGmailTransport, type NotifyOutcome } from "@/lib/planning/notify";
import { sendMessage } from "@/lib/recus/gmail";
import { encodeHeader } from "@/lib/recus/mime";

/**
 * L'e-mail d'un message du fil d'un élément de langage.
 *
 * Même transport que les retours du planning — la boîte Gmail des Reçus, la
 * seule du produit : le message part de l'adresse de l'agence, celle à
 * laquelle le client répond. Le gabarit est distinct de celui du planning
 * parce que l'objet et le bouton ne parlent pas d'une publication : ici on
 * demande l'autorisation d'employer une formule.
 *
 * Aucun échec ne remonte en exception : le message est déjà écrit quand on
 * arrive ici, et perdre un e-mail ne doit jamais perdre le message.
 */

export type FaqCommentNotification = {
  recipients: string[];
  workspaceSlug: string;
  workspaceName: string;
  entryId: string;
  entryTitle: string;
  authorName: string;
  body: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Base64 replié à 76 colonnes, comme l'exige la RFC 2045. */
function foldBase64(content: Buffer): string {
  const encoded = content.toString("base64");
  const lines: string[] = [];
  for (let index = 0; index < encoded.length; index += 76) {
    lines.push(encoded.slice(index, index + 76));
  }
  return lines.join("\r\n");
}

export function buildFaqCommentHtml(email: {
  workspaceName: string;
  entryTitle: string;
  authorName: string;
  body: string;
  link: string;
}): string {
  const body = escapeHtml(email.body).replaceAll("\n", "<br />");

  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:24px;background-color:#f4f3f0;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
    <div style="max-width:560px;margin:0 auto;background-color:#ffffff;border:1px solid #e4e2dd;border-radius:12px;padding:28px;">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#6f6b63;">
        ${escapeHtml(email.workspaceName)} · FAQ
      </p>
      <h1 style="margin:0 0 16px;font-size:18px;line-height:1.35;">
        ${escapeHtml(email.entryTitle || "Élément de langage")}
      </h1>
      <p style="margin:0 0 8px;font-size:13px;color:#6f6b63;">
        ${escapeHtml(email.authorName)} vous écrit :
      </p>
      <div style="margin:0 0 20px;padding:12px 16px;background-color:#f8f7f5;border-left:3px solid #1a1a1a;border-radius:0 8px 8px 0;font-size:14px;line-height:1.55;">
        ${body}
      </div>
      <a href="${escapeHtml(email.link)}" style="display:inline-block;padding:10px 18px;background-color:#1a1a1a;color:#ffffff;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">
        Ouvrir la FAQ
      </a>
    </div>
  </body>
</html>`;
}

export function buildFaqCommentMime(email: {
  from: string;
  to: string;
  workspaceName: string;
  entryTitle: string;
  authorName: string;
  body: string;
  link: string;
}): string {
  const headers = [
    `From: ${email.from}`,
    `To: ${email.to}`,
    `Subject: ${encodeHeader(
      `FAQ — ${email.entryTitle || "élément de langage"} (${email.workspaceName})`,
    )}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
  ];

  return `${headers.join("\r\n")}\r\n\r\n${foldBase64(
    Buffer.from(buildFaqCommentHtml(email), "utf8"),
  )}\r\n`;
}

export async function sendFaqCommentEmails(
  notification: FaqCommentNotification,
): Promise<NotifyOutcome> {
  const gmail = await getGmailTransport();
  if (!gmail.ok) {
    return { sent: [], failed: notification.recipients, reason: gmail.reason };
  }
  const { accessToken, from } = gmail.transport;

  const link = `${publicEnv.NEXT_PUBLIC_SITE_URL}/espace/${notification.workspaceSlug}/faq?entree=${notification.entryId}`;

  const sent: string[] = [];
  const failed: string[] = [];
  let lastError: string | undefined;

  for (const recipient of notification.recipients) {
    try {
      await sendMessage({
        accessToken,
        mime: buildFaqCommentMime({
          from,
          to: recipient,
          workspaceName: notification.workspaceName,
          entryTitle: notification.entryTitle,
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

  return { sent, failed, reason: sent.length === 0 ? lastError : undefined };
}
