import { encodeHeader } from "@/lib/recus/mime";

/**
 * Le courriel qui ouvre un espace client — fonctions **pures**, zéro import
 * Supabase, zéro appel réseau. L'envoi vit dans `send-access.ts` ; ici on ne
 * fabrique que le lien et le message, ce qui les rend lisibles dans un test
 * sans boîte mail.
 *
 * Deux messages, une seule mécanique :
 *
 * - **l'invitation**, envoyée quand on ouvre un espace à une adresse depuis la
 *   gestion des accès ;
 * - **le lien de connexion**, demandé depuis `/login` — par un client qui
 *   revient, ou par l'agence elle-même.
 *
 * Jusqu'au 1/10/2026 ni l'un ni l'autre ne partait : l'invitation n'écrivait
 * qu'une ligne en base, et le lien de connexion passait par la boîte d'envoi
 * de Supabase, qui ne délivre qu'aux membres de l'équipe du projet. Un client
 * invité ne recevait jamais rien.
 */

export type AccessEmailKind = "invitation" | "connexion";

/**
 * Le lien à mettre dans le courriel.
 *
 * Même forme que celui de l'Academy (`onboardingLink`), et pour les mêmes
 * raisons : `token_hash`, parce que le lien s'ouvre ailleurs que dans le
 * navigateur qui l'a demandé ; une page à un bouton (`/auth/acces`) plutôt que
 * le point d'atterrissage, parce que les messageries ouvrent les liens avant
 * la personne et qu'un jeton ne sert qu'une fois.
 */
export function accessLink(options: {
  siteUrl: string;
  tokenHash: string;
  /** Le type rendu par `generateLink` — `invite` ou `magiclink`. */
  type: string;
  /** Chemin interne où la personne arrive une fois connectée. */
  destination: string;
}): string {
  const base = options.siteUrl.replace(/\/+$/, "");
  const query = new URLSearchParams({
    token_hash: options.tokenHash,
    type: options.type,
    suivant: options.destination,
  });
  return `${base}/auth/acces?${query.toString()}`;
}

/**
 * Le libellé du bouton de `/auth/acces`, d'après l'endroit où il mène : une
 * cliente qui ouvre son planning ne doit pas lire « Entrer dans la
 * formation ».
 */
export function accessButtonLabel(destination: string | null | undefined): string {
  if (destination?.startsWith("/academy")) return "Entrer dans la formation";
  if (destination?.startsWith("/espace/")) return "Accéder à mon espace";
  return "Me connecter";
}

export type AccessEmail = {
  kind: AccessEmailKind;
  from: string;
  to: string;
  /** Nul quand on ne connaît pas le prénom : le message dit alors « Bonjour, ». */
  firstName: string | null;
  /** L'espace ouvert — l'invitation le nomme ; le lien de connexion s'en passe. */
  workspaceName: string | null;
  link: string;
  /** Où redemander un lien, une fois celui-ci expiré. */
  loginUrl: string;
  /** Ce qui signe le message — l'expéditeur humain, pas le domaine. */
  senderName: string;
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

export function accessSubject(email: Pick<AccessEmail, "kind" | "workspaceName">): string {
  if (email.kind === "invitation" && email.workspaceName) {
    return `Votre espace ${email.workspaceName} est ouvert`;
  }
  return "Votre lien de connexion";
}

function greetingOf(email: AccessEmail): string {
  return email.firstName ? `Bonjour ${email.firstName},` : "Bonjour,";
}

/** Le paragraphe principal, en texte : le HTML et la version texte le partagent. */
function leadOf(email: AccessEmail): string {
  if (email.kind === "invitation" && email.workspaceName) {
    return `Votre espace ${email.workspaceName} est ouvert : votre planning éditorial, vos contenus à valider et votre reporting, au même endroit. Le lien ci-dessous vous connecte directement, sans mot de passe.`;
  }
  return "Voici votre lien de connexion. Il vous connecte directement, sans mot de passe.";
}

function buttonOf(email: AccessEmail): string {
  return email.kind === "invitation" ? "Accéder à mon espace" : "Me connecter";
}

function expiryOf(email: AccessEmail): string {
  return `Ce lien est valable une heure et ne sert qu'une fois. Passé ce délai, saisissez votre adresse sur ${email.loginUrl} : un nouveau lien vous parvient aussitôt.`;
}

export function buildAccessHtml(email: AccessEmail): string {
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:24px;background-color:#f4f3f0;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
    <div style="max-width:560px;margin:0 auto;background-color:#ffffff;border:1px solid #e4e2dd;border-radius:12px;padding:28px;">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#6f6b63;">
        Antidotes
      </p>
      <h1 style="margin:0 0 16px;font-size:18px;line-height:1.35;">
        ${escapeHtml(accessSubject(email))}
      </h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.55;">
        ${escapeHtml(greetingOf(email))}<br /><br />
        ${escapeHtml(leadOf(email))}
      </p>
      <a href="${escapeHtml(email.link)}" style="display:inline-block;padding:10px 18px;background-color:#1a1a1a;color:#ffffff;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">
        ${escapeHtml(buttonOf(email))}
      </a>
      <p style="margin:20px 0 0;font-size:13px;line-height:1.55;color:#6f6b63;">
        ${escapeHtml(expiryOf(email))}
      </p>
      <p style="margin:20px 0 0;font-size:14px;line-height:1.55;">
        À très vite,<br />${escapeHtml(email.senderName)}
      </p>
    </div>
  </body>
</html>`;
}

/**
 * La version texte, envoyée à côté du HTML : un message à une seule partie
 * est pénalisé par les filtres, et celui-ci part à des adresses qui n'ont
 * encore jamais reçu de courriel de l'agence.
 */
export function buildAccessText(email: AccessEmail): string {
  return [
    greetingOf(email),
    "",
    leadOf(email),
    "",
    `${buttonOf(email)} :`,
    email.link,
    "",
    expiryOf(email),
    "",
    "À très vite,",
    email.senderName,
  ].join("\n");
}

/** Le message complet, en `multipart/alternative`. */
export function buildAccessMime(email: AccessEmail): string {
  // Fixe, et faite d'une séquence qu'aucun des deux corps ne produit.
  const boundary = "antidotes-acces-espace-boundary";

  const headers = [
    `From: ${email.from}`,
    `To: ${email.to}`,
    `Subject: ${encodeHeader(accessSubject(email))}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  const parts = [
    [
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      foldBase64(Buffer.from(buildAccessText(email), "utf8")),
    ].join("\r\n"),
    [
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      foldBase64(Buffer.from(buildAccessHtml(email), "utf8")),
    ].join("\r\n"),
    `--${boundary}--`,
  ];

  return `${headers.join("\r\n")}\r\n\r\n${parts.join("\r\n")}\r\n`;
}
