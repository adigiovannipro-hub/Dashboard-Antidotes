/**
 * Construction du message transféré à Airwallex.
 *
 * Le format compte plus qu'il n'y paraît : à l'autre bout, ce n'est pas un
 * humain qui lit mais un OCR qui cherche un montant, une date et un marchand.
 * Deux conséquences dans ce qui suit :
 *
 *   • le corps répète en texte brut ce qu'on a extrait de la pièce. Si le PDF
 *     est mal océrisé, ces lignes restent lisibles et donnent au service de quoi
 *     rapprocher quand même ;
 *
 *   • rien d'autre n'est ajouté. Pas de signature, pas de bandeau, pas de
 *     « envoyé par Antidotes » — chaque phrase superflue est un montant ou une
 *     date de plus à confondre avec les bons.
 *
 * Module pur : il rend une chaîne, l'envoi est ailleurs.
 */

export type ForwardMessage = {
  from: string;
  to: string;
  subject: string | null;
  /** Corps texte de la pièce d'origine, tronqué au besoin. */
  originalBody: string;
  attachment: {
    filename: string;
    contentType: string;
    content: Buffer;
  } | null;
  /** Ce que l'extraction a retenu, répété en clair pour l'OCR. */
  summary: {
    merchant: string | null;
    amount: string | null;
    date: string | null;
    invoiceNumber: string | null;
  };
};

/**
 * Encodage RFC 2047 des en-têtes non ASCII.
 *
 * Un sujet contenant « Facture réglée » passé tel quel donne des caractères
 * cassés chez le destinataire, et un OCR qui lit « FactureÂ rÃ©glÃ©e ».
 */
export function encodeHeader(value: string): string {
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
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

/**
 * Neutralise les sauts de ligne dans une valeur d'en-tête.
 *
 * Un sujet de mail est une donnée venue de l'extérieur. Sans ce nettoyage, un
 * `\r\n` glissé dedans injecterait des en-têtes arbitraires dans le message —
 * un `Bcc:` par exemple, qui enverrait vos factures ailleurs.
 */
function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

/**
 * Réduit un nom de fichier à un jeu de caractères sûr.
 *
 * Liste blanche plutôt que liste noire : le nom vient d'un mail reçu, et
 * énumérer ce qui pourrait refermer les guillemets du paramètre `filename`
 * revient à parier qu'on n'a rien oublié. Ce qui n'est pas explicitement
 * autorisé devient un souligné.
 */
function sanitizeFilename(name: string): string {
  const safe = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^[._-]+/, "")
    .slice(0, 120);
  return safe || "piece.pdf";
}

const MAX_BODY_CHARS = 4000;

export function buildForwardMime(message: ForwardMessage): string {
  const boundary = `antidotes-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;

  const subject = sanitizeHeaderValue(message.subject ?? "Justificatif");

  const summaryLines = [
    message.summary.merchant && `Fournisseur : ${message.summary.merchant}`,
    message.summary.amount && `Montant : ${message.summary.amount}`,
    message.summary.date && `Date : ${message.summary.date}`,
    message.summary.invoiceNumber &&
      `Numéro de facture : ${message.summary.invoiceNumber}`,
  ].filter((line): line is string => Boolean(line));

  const body = [
    ...summaryLines,
    summaryLines.length > 0 ? "" : null,
    message.originalBody.slice(0, MAX_BODY_CHARS),
  ]
    .filter((line): line is string => line !== null)
    .join("\r\n");

  const headers = [
    `From: ${sanitizeHeaderValue(message.from)}`,
    `To: ${sanitizeHeaderValue(message.to)}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
  ];

  if (!message.attachment) {
    /* Sans PDF, le mail part en texte simple. L'OCR d'Airwallex sait lire un
       corps de message — c'est même le cas le plus fréquent pour les reçus de
       course, qui n'ont jamais eu de pièce jointe. */
    return [
      ...headers,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      foldBase64(Buffer.from(body, "utf8")),
      "",
    ].join("\r\n");
  }

  const filename = sanitizeFilename(message.attachment.filename);

  return [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    foldBase64(Buffer.from(body, "utf8")),
    "",
    `--${boundary}`,
    `Content-Type: ${message.attachment.contentType}; name="${filename}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${filename}"`,
    "",
    foldBase64(message.attachment.content),
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");
}
