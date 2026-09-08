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
import { SIGNATURE_IMAGES } from "./signature-assets";

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
  /**
   * La carte de signature, placée **après** la pièce jointe.
   *
   * L'ordre des parties est l'ordre d'affichage : un mail écrit à la main se
   * lit message, puis facture, puis carte de visite. Absente : le message
   * porte sa signature de bout en bout, comme avant.
   */
  signature?: { text: string; html: string | null } | null;
};

/** Un identifiant de `Content-ID`, réduit à un jeu de caractères sûr. */
function sanitizeCid(cid: string): string {
  return cid.replace(/[^A-Za-z0-9._-]+/g, "");
}

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

  /* Un bloc de texte, seul ou doublé de sa version HTML dans un
     `alternative` — le HTML en second, un client de messagerie retenant la
     dernière version qu'il sait afficher. */
  const textBlock = (text: string) => [
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    foldBase64(Buffer.from(text, "utf8")),
    "",
  ];

  let alternativeSeq = 0;
  const block = (text: string, html: string | null) => {
    if (!html) return textBlock(text);
    const inner = `${boundary}-alt${(alternativeSeq += 1)}`;
    return [
      `Content-Type: multipart/alternative; boundary="${inner}"`,
      "",
      `--${inner}`,
      ...textBlock(text),
      `--${inner}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      foldBase64(Buffer.from(html, "utf8")),
      "",
      `--${inner}--`,
      "",
    ];
  };

  /* La carte de visite et ses images dans un même `related` : c'est ce qui
     lie un `cid:` du HTML à la pièce qui le porte. Posées à côté dans le
     `mixed`, certains clients les affichent en pièces jointes séparées au
     lieu de les rendre dans la signature. */
  const signaturePart = (signature: { text: string; html: string | null }) => {
    const inner = block(signature.text, signature.html ?? null);
    if (!signature.html || SIGNATURE_IMAGES.length === 0) return inner;

    const related = `${boundary}-rel`;
    return [
      `Content-Type: multipart/related; boundary="${related}"`,
      "",
      `--${related}`,
      ...inner,
      ...SIGNATURE_IMAGES.flatMap((image) => {
        const cid = sanitizeCid(image.cid);
        const filename = sanitizeFilename(image.filename);
        return [
          `--${related}`,
          `Content-Type: ${image.contentType}; name="${filename}"`,
          "Content-Transfer-Encoding: base64",
          `Content-ID: <${cid}>`,
          `Content-Disposition: inline; filename="${filename}"`,
          "",
          image.base64.replace(/\s+/g, "").replace(/(.{76})/g, "$1\r\n"),
          "",
        ];
      }),
      `--${related}--`,
      "",
    ];
  };

  if (!message.attachment) {
    return [...headers, ...block(message.body, message.bodyHtml ?? null)].join("\r\n");
  }

  const filename = sanitizeFilename(message.attachment.filename);

  /* L'ordre des parties **est** l'ordre d'affichage : message, facture,
     carte de signature. Un mail écrit à la main se lit ainsi, et une pièce
     jointe reléguée sous le numéro de téléphone se cherche. */
  const attachmentPart = [
    `--${boundary}`,
    `Content-Type: application/pdf; name="${filename}"`,
    "Content-Transfer-Encoding: base64",
    /* `inline` et non `attachment` : les clients qui savent la rendre
       l'affichent à sa place dans le fil du message. Les autres la mettent
       en pièce jointe, ce qui est le comportement d'avant. */
    `Content-Disposition: inline; filename="${filename}"`,
    "",
    foldBase64(message.attachment.content),
    "",
  ];

  return [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    ...block(message.body, message.bodyHtml ?? null),
    ...attachmentPart,
    ...(message.signature
      ? [`--${boundary}`, ...signaturePart(message.signature)]
      : []),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}
