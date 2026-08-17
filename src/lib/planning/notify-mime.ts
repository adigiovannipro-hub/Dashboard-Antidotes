import { encodeHeader } from "@/lib/recus/mime";

/**
 * Le courriel d'un retour — ce que reçoit une adresse taguée dans le fil.
 *
 * Fonction pure : l'e-mail se lit dans un test, sans Gmail ni base. La mise en
 * page est celle d'une notification sobre — l'objet dit la publication, le
 * corps cite le retour, un lien ramène à la ligne du planning — et tout est en
 * styles inline, seuls survivants des clients mail.
 */

export type CommentEmail = {
  from: string;
  to: string;
  workspaceName: string;
  subjectName: string;
  /** Le réseau de la publication — « INSTAGRAM », « META »… */
  laneName: string;
  authorName: string;
  /** Le retour, en texte brut : les sauts de ligne sont respectés. */
  body: string;
  /** URL directe vers la publication, panneau ouvert. */
  link: string;
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
  for (let i = 0; i < encoded.length; i += 76) {
    lines.push(encoded.slice(i, i + 76));
  }
  return lines.join("\r\n");
}

export function buildCommentHtml(email: CommentEmail): string {
  const body = escapeHtml(email.body).replaceAll("\n", "<br />");

  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:24px;background-color:#f4f3f0;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
    <div style="max-width:560px;margin:0 auto;background-color:#ffffff;border:1px solid #e4e2dd;border-radius:12px;padding:28px;">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#6f6b63;">
        ${escapeHtml(email.workspaceName)} · ${escapeHtml(email.laneName)}
      </p>
      <h1 style="margin:0 0 16px;font-size:18px;line-height:1.35;">
        ${escapeHtml(email.subjectName || "Publication sans titre")}
      </h1>
      <p style="margin:0 0 8px;font-size:13px;color:#6f6b63;">
        ${escapeHtml(email.authorName)} a laissé un retour :
      </p>
      <div style="margin:0 0 20px;padding:12px 16px;background-color:#f8f7f5;border-left:3px solid #1a1a1a;border-radius:0 8px 8px 0;font-size:14px;line-height:1.55;">
        ${body}
      </div>
      <a href="${escapeHtml(email.link)}" style="display:inline-block;padding:10px 18px;background-color:#1a1a1a;color:#ffffff;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">
        Ouvrir la publication
      </a>
      <p style="margin:20px 0 0;font-size:11px;color:#a09b91;">
        Envoyé depuis le planning éditorial Antidotes.
      </p>
    </div>
  </body>
</html>`;
}

export function buildCommentMime(email: CommentEmail): string {
  const headers = [
    `From: ${email.from}`,
    `To: ${email.to}`,
    `Subject: ${encodeHeader(`Retour — ${email.subjectName || "publication"} (${email.workspaceName})`)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
  ];

  return `${headers.join("\r\n")}\r\n\r\n${foldBase64(
    Buffer.from(buildCommentHtml(email), "utf8"),
  )}\r\n`;
}

/**
 * Le courriel d'envoi en validation — la carte cockpit prévient le client que
 * son planning du mois est prêt à relire. Même langage visuel que le retour.
 */
export type ValidationEmail = {
  from: string;
  to: string;
  workspaceName: string;
  /** « septembre 2026 » — déjà formaté, le mail ne calcule rien. */
  monthLabel: string;
  /** URL du planning de l'espace. */
  link: string;
};

export function buildValidationHtml(email: ValidationEmail): string {
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:24px;background-color:#f4f3f0;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
    <div style="max-width:560px;margin:0 auto;background-color:#ffffff;border:1px solid #e4e2dd;border-radius:12px;padding:28px;">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#6f6b63;">
        ${escapeHtml(email.workspaceName)} · Planning éditorial
      </p>
      <h1 style="margin:0 0 16px;font-size:18px;line-height:1.35;">
        Le planning de ${escapeHtml(email.monthLabel)} est prêt
      </h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.55;">
        Bonjour ${escapeHtml(email.workspaceName)},<br /><br />
        le planning du mois de ${escapeHtml(email.monthLabel)} est disponible
        pour review. Vos retours se laissent directement sur chaque
        publication.
      </p>
      <a href="${escapeHtml(email.link)}" style="display:inline-block;padding:10px 18px;background-color:#1a1a1a;color:#ffffff;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">
        Ouvrir le planning
      </a>
      <p style="margin:20px 0 0;font-size:11px;color:#a09b91;">
        Envoyé depuis le planning éditorial Antidotes.
      </p>
    </div>
  </body>
</html>`;
}

export function buildValidationMime(email: ValidationEmail): string {
  const headers = [
    `From: ${email.from}`,
    `To: ${email.to}`,
    `Subject: ${encodeHeader(`Planning ${email.monthLabel} — disponible pour review (${email.workspaceName})`)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
  ];

  return `${headers.join("\r\n")}\r\n\r\n${foldBase64(
    Buffer.from(buildValidationHtml(email), "utf8"),
  )}\r\n`;
}
