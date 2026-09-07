import { encodeHeader } from "@/lib/recus/mime";

/**
 * L'email d'une étape, prêt pour Gmail — fonction pure, lisible dans un test.
 *
 * Ce qui distingue un email de prospection des autres courriels du produit :
 *
 *   • **Un Message-ID à nous**, et `In-Reply-To` / `References` sur les
 *     relances : la relance arrive dans le même fil chez le destinataire, et
 *     c'est aussi ce qui nous permet de relire ce fil pour y voir une
 *     réponse. Gmail garde le Message-ID fourni.
 *   • **Le lien de désinscription**, deux fois : en bas du message, et dans
 *     `List-Unsubscribe` (+ `List-Unsubscribe-Post`, RFC 8058) pour que la
 *     messagerie propose le geste d'un clic — Gmail et Yahoo l'exigent des
 *     expéditeurs en volume depuis 2024. C'est l'obligation non paramétrable
 *     du cahier des charges.
 *   • **Texte et HTML**, le HTML restant du texte mis en paragraphes : pas de
 *     gabarit graphique, pas d'image, pas de pièce jointe. Un email de
 *     prospection qui ressemble à une newsletter est lu comme une newsletter.
 */

export type OutreachEmail = {
  from: string;
  fromName: string | null;
  to: string;
  subject: string;
  /** Le corps rendu, en texte brut : les sauts de ligne sont respectés. */
  body: string;
  messageId: string;
  /** Le Message-ID du message précédent du fil, sur une relance. */
  inReplyTo: string | null;
  unsubscribeUrl: string;
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

const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/g;

/** Un paragraphe de texte en HTML : entités échappées, URL cliquables, sauts conservés. */
export function paragraphToHtml(paragraph: string): string {
  const escaped = escapeHtml(paragraph);
  const linked = escaped.replace(URL_PATTERN, (url) => `<a href="${url}" style="color:#2f5320;">${url}</a>`);
  return linked.replaceAll("\n", "<br />");
}

export function buildOutreachHtml(email: OutreachEmail): string {
  const paragraphs = email.body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p style="margin:0 0 14px;">${paragraphToHtml(paragraph)}</p>`)
    .join("\n");

  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.55;color:#1a1a1a;">
${paragraphs}
    <p style="margin:24px 0 0;font-size:11px;line-height:1.5;color:#6f6b63;">
      Vous recevez ce message parce que votre fonction est en rapport avec son sujet.
      <a href="${escapeHtml(email.unsubscribeUrl)}" style="color:#6f6b63;">Ne plus recevoir mes messages</a>
    </p>
  </body>
</html>`;
}

export function buildOutreachText(email: OutreachEmail): string {
  return [
    email.body.replace(/\r\n/g, "\n").trim(),
    "",
    "--",
    `Pour ne plus recevoir mes messages : ${email.unsubscribeUrl}`,
  ].join("\n");
}

/** `Prénom Nom <adresse>` quand on a un nom, l'adresse nue sinon. */
export function formatSender(from: string, fromName: string | null): string {
  const name = fromName?.trim();
  return name ? `${encodeHeader(name)} <${from}>` : from;
}

export function buildOutreachMime(email: OutreachEmail): string {
  const boundary = "antidotes-outreach-boundary";

  const headers = [
    `From: ${formatSender(email.from, email.fromName)}`,
    `To: ${email.to}`,
    `Subject: ${encodeHeader(email.subject)}`,
    `Message-ID: ${email.messageId}`,
    ...(email.inReplyTo
      ? [`In-Reply-To: ${email.inReplyTo}`, `References: ${email.inReplyTo}`]
      : []),
    `List-Unsubscribe: <${email.unsubscribeUrl}>`,
    "List-Unsubscribe-Post: List-Unsubscribe=One-Click",
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  const parts = [
    [
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      foldBase64(Buffer.from(buildOutreachText(email), "utf8")),
    ].join("\r\n"),
    [
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      foldBase64(Buffer.from(buildOutreachHtml(email), "utf8")),
    ].join("\r\n"),
    `--${boundary}--`,
  ];

  return `${headers.join("\r\n")}\r\n\r\n${parts.join("\r\n")}\r\n`;
}

/** Un Message-ID au domaine de l'expéditeur : `<uuid@antidotes.fr>`. */
export function newMessageId(from: string, uuid: string): string {
  const domain = from.split("@")[1] || "antidotes.local";
  return `<${uuid}@${domain}>`;
}

/** L'objet d'une relance : « Re: » devant l'objet du premier message, une seule fois. */
export function replySubject(subject: string): string {
  return /^re\s*:/i.test(subject.trim()) ? subject.trim() : `Re: ${subject.trim()}`;
}
