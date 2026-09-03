/**
 * Le message envoyé au client : objet, corps, facture en pièce jointe.
 *
 * Module pur — il rend une chaîne, l'envoi est ailleurs.
 *
 * Cousin de `src/lib/recus/mime.ts` sans en être une variante : celui-là
 * fabrique un message destiné à un OCR, sans copie ni destinataire multiple,
 * et son corps répète volontairement des chiffres pour aider la machine qui
 * le lit. Celui-ci s'adresse à une personne, porte des copies visibles et une
 * copie cachée. Les deux partagent le petit vocabulaire du format MIME —
 * `encodeHeader` est importé de l'autre, le reste tient en trente lignes et
 * n'a pas mérité un troisième module.
 */

import { encodeHeader } from "@/lib/recus/mime";

export type InvoiceMessage = {
  from: string;
  to: string;
  cc: string[];
  /** Toujours renseigné en pratique — la copie cachée est constante. */
  bcc: string | null;
  subject: string;
  body: string;
  /**
   * La même chose en HTML, quand une signature riche est posée. Les deux
   * partent ensemble (`multipart/alternative`) et le client de messagerie
   * choisit : le texte n'est pas un pis-aller, c'est la version qui arrive
   * intacte partout.
   */
  bodyHtml?: string | null;
  attachment: {
    filename: string;
    content: Buffer;
  } | null;
};

/**
 * Neutralise les sauts de ligne d'un en-tête.
 *
 * Un objet de mail est construit à partir d'un modèle éditable. Sans ce
 * nettoyage, un `\r\n` glissé dedans injecterait des en-têtes arbitraires —
 * un `Bcc:` par exemple, qui enverrait la facture ailleurs.
 */
function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

/** Réduit un nom de fichier à un jeu de caractères sûr. Liste blanche. */
function sanitizeFilename(name: string): string {
  const safe = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^[._-]+/, "")
    .slice(0, 120);
  return safe || "facture.pdf";
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

export function buildInvoiceMime(message: InvoiceMessage): string {
  const boundary = `antidotes-facture-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;

  const headers = [
    `From: ${sanitizeHeaderValue(message.from)}`,
    `To: ${sanitizeHeaderValue(message.to)}`,
  ];
  const cc = message.cc.map(sanitizeHeaderValue).filter(Boolean);
  if (cc.length > 0) headers.push(`Cc: ${cc.join(", ")}`);
  /* Le `Bcc:` d'un message soumis à l'API Gmail est honoré puis retiré à
     l'envoi : le destinataire ne le voit pas, la copie part quand même. */
  if (message.bcc) headers.push(`Bcc: ${sanitizeHeaderValue(message.bcc)}`);
  headers.push(`Subject: ${encodeHeader(sanitizeHeaderValue(message.subject))}`);
  headers.push("MIME-Version: 1.0");

  const textPart = [
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    foldBase64(Buffer.from(message.body, "utf8")),
    "",
  ];

  /* Avec une version HTML, les deux partent dans un `alternative` — et le
     HTML en second, parce qu'un client de messagerie retient la dernière
     version qu'il sait afficher. */
  const inner = `${boundary}-alt`;
  const bodyLines = message.bodyHtml
    ? [
        `Content-Type: multipart/alternative; boundary="${inner}"`,
        "",
        `--${inner}`,
        ...textPart,
        `--${inner}`,
        'Content-Type: text/html; charset="UTF-8"',
        "Content-Transfer-Encoding: base64",
        "",
        foldBase64(Buffer.from(message.bodyHtml, "utf8")),
        "",
        `--${inner}--`,
        "",
      ]
    : textPart;

  if (!message.attachment) {
    return [...headers, ...bodyLines].join("\r\n");
  }

  const filename = sanitizeFilename(message.attachment.filename);

  return [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    ...bodyLines,
    `--${boundary}`,
    `Content-Type: application/pdf; name="${filename}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${filename}"`,
    "",
    foldBase64(message.attachment.content),
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");
}
