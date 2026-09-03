import { encodeHeader } from "@/lib/recus/mime";

/**
 * Le courriel d'arrivée dans une formation — fonctions **pures**, zéro import
 * Supabase, zéro appel réseau. L'envoi vit dans `onboarding.ts` ; ici on ne
 * fabrique que le lien et le message, ce qui les rend lisibles dans un test
 * sans boîte mail.
 *
 * Même langage visuel que les courriels du Planning (`notify-mime.ts`) : c'est
 * la même agence qui écrit, et une élève qui reçoit ensuite un retour sur son
 * travail doit reconnaître l'expéditeur.
 */

/**
 * Le lien à mettre dans le courriel.
 *
 * Il pointe le point d'atterrissage du magic link sous sa forme
 * `token_hash` — celle qui fonctionne quand le lien est ouvert **ailleurs**
 * que dans le navigateur qui l'a demandé, ce qui est exactement le cas d'une
 * invitation : personne n'a rien demandé depuis son navigateur. La forme PKCE
 * (`?code=`) échouerait, son vérificateur n'existant nulle part.
 *
 * `suivant` ramène droit sur la formation : une élève n'a rien à faire sur
 * l'accueil de l'application.
 */
export function onboardingLink(options: {
  siteUrl: string;
  tokenHash: string;
  /** Le type rendu par `generateLink` — `invite` ou `magiclink`. */
  type: string;
  courseSlug: string;
}): string {
  const destination = `/academy/${options.courseSlug}`;
  const base = options.siteUrl.replace(/\/+$/, "");
  const query = new URLSearchParams({
    token_hash: options.tokenHash,
    type: options.type,
    suivant: destination,
  });
  return `${base}/auth/callback?${query.toString()}`;
}

export type OnboardingEmail = {
  from: string;
  to: string;
  /** Nul quand on ne connaît pas le prénom : le message dit alors « Salut, ». */
  firstName: string | null;
  courseTitle: string;
  link: string;
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

export function onboardingSubject(courseTitle: string): string {
  return `Ton accès à « ${courseTitle} »`;
}

export function buildOnboardingHtml(email: OnboardingEmail): string {
  const greeting = email.firstName ? `Salut ${email.firstName},` : "Salut,";

  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:24px;background-color:#f4f3f0;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
    <div style="max-width:560px;margin:0 auto;background-color:#ffffff;border:1px solid #e4e2dd;border-radius:12px;padding:28px;">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#6f6b63;">
        Antidotes Academy
      </p>
      <h1 style="margin:0 0 16px;font-size:18px;line-height:1.35;">
        ${escapeHtml(email.courseTitle)}
      </h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.55;">
        ${escapeHtml(greeting)}<br /><br />
        Ton accès à la formation est ouvert. Le lien ci-dessous te connecte
        directement, sans mot de passe à retenir.
      </p>
      <a href="${escapeHtml(email.link)}" style="display:inline-block;padding:10px 18px;background-color:#1a1a1a;color:#ffffff;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">
        Entrer dans la formation
      </a>
      <p style="margin:20px 0 0;font-size:13px;line-height:1.55;color:#6f6b63;">
        Il est valable 24 heures — passé ce délai, demande-m'en un nouveau.
        Une fois à l'intérieur, commence par renseigner ton profil : photo,
        prénom, nom. C'est le premier écran, ça prend une minute.
      </p>
      <p style="margin:20px 0 0;font-size:14px;line-height:1.55;">
        Bon travail,<br />${escapeHtml(email.senderName)}
      </p>
    </div>
  </body>
</html>`;
}

/**
 * La version texte, envoyée à côté du HTML.
 *
 * Les messageries qui refusent le HTML afficheraient une page blanche, et un
 * message qui n'a qu'une partie est pénalisé par les filtres anti-spam — ce
 * qui, pour un courriel dont le seul travail est de faire cliquer un lien,
 * serait fatal.
 */
export function buildOnboardingText(email: OnboardingEmail): string {
  const greeting = email.firstName ? `Salut ${email.firstName},` : "Salut,";

  return [
    greeting,
    "",
    `Ton accès à « ${email.courseTitle} » est ouvert.`,
    "",
    "Clique sur ce lien pour entrer — il te connecte directement, sans mot de passe :",
    email.link,
    "",
    "Le lien est valable 24 heures. Passé ce délai, demande-m'en un nouveau.",
    "",
    "Une fois à l'intérieur, commence par renseigner ton profil (photo, prénom, nom) : c'est le premier écran, ça prend une minute.",
    "",
    "Bon travail,",
    email.senderName,
  ].join("\n");
}

/**
 * Le message complet, en `multipart/alternative`.
 *
 * Les courriels du Planning n'envoient que du HTML ; celui-ci porte les deux
 * parties parce qu'il part à des adresses inconnues — une élève qui vient
 * d'acheter — là où le Planning écrit à des partenaires déjà en relation.
 */
export function buildOnboardingMime(email: OnboardingEmail): string {
  // Une frontière qui ne peut pas apparaître dans le contenu : elle est fixe
  // et contient une séquence qu'aucun de nos deux corps ne produit.
  const boundary = "antidotes-academy-onboarding-boundary";

  const headers = [
    `From: ${email.from}`,
    `To: ${email.to}`,
    `Subject: ${encodeHeader(onboardingSubject(email.courseTitle))}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  const parts = [
    [
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      foldBase64(Buffer.from(buildOnboardingText(email), "utf8")),
    ].join("\r\n"),
    [
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      foldBase64(Buffer.from(buildOnboardingHtml(email), "utf8")),
    ].join("\r\n"),
    `--${boundary}--`,
  ];

  return `${headers.join("\r\n")}\r\n\r\n${parts.join("\r\n")}\r\n`;
}
