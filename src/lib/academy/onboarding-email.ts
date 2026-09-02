/**
 * Le courriel d'arrivée dans une formation — fonctions **pures**, zéro import
 * Supabase, zéro appel réseau. L'envoi vit dans `onboarding.ts` ; ici on ne
 * fabrique que le lien et le texte, ce qui les rend testables sans boîte mail.
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
  subject: string;
  text: string;
  html: string;
};

/**
 * Le contenu du courriel.
 *
 * Tutoiement et phrases courtes : c'est le ton de la formation, et le message
 * n'a qu'un travail — faire cliquer. Une version texte accompagne la version
 * HTML, sans quoi les messageries qui refusent le HTML affichent une page
 * blanche, et les filtres anti-spam pénalisent un message qui n'a qu'une
 * partie.
 */
export function buildOnboardingEmail(options: {
  firstName: string | null;
  courseTitle: string;
  link: string;
  /** Ce qui signe le message — l'expéditeur humain, pas le domaine. */
  senderName: string;
}): OnboardingEmail {
  const greeting = options.firstName ? `Salut ${options.firstName},` : "Salut,";

  const text = [
    greeting,
    "",
    `Ton accès à « ${options.courseTitle} » est ouvert.`,
    "",
    "Clique sur ce lien pour entrer — il te connecte directement, sans mot de passe à retenir :",
    options.link,
    "",
    "Le lien est valable 24 heures. Passé ce délai, demande-m'en un nouveau.",
    "",
    "Une fois à l'intérieur, commence par renseigner ton profil (photo, prénom, nom) : c'est le premier écran, ça prend une minute.",
    "",
    "Bon travail,",
    options.senderName,
  ].join("\n");

  // Styles en ligne, tableau de mise en page, aucune police externe : les
  // clients de messagerie ignorent les feuilles de style et les balises
  // modernes. Ce n'est pas du HTML de site, c'est du HTML de courriel.
  const html = `<!doctype html>
<html lang="fr">
<body style="margin:0;padding:24px;background:#f5f4f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e4e2dd;border-radius:16px;">
    <tr><td style="padding:32px;">
      <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 24px;font-size:16px;line-height:1.5;">
        Ton accès à <strong>${escapeHtml(options.courseTitle)}</strong> est ouvert.
      </p>
      <p style="margin:0 0 24px;">
        <a href="${escapeHtml(options.link)}" style="display:inline-block;padding:12px 20px;background:#1a1a1a;color:#ffffff;text-decoration:none;border-radius:12px;font-size:15px;font-weight:600;">
          Entrer dans la formation
        </a>
      </p>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#5c5a55;">
        Le lien te connecte directement, sans mot de passe. Il est valable 24 heures ;
        passé ce délai, demande-m'en un nouveau.
      </p>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#5c5a55;">
        Une fois à l'intérieur, commence par renseigner ton profil — photo, prénom, nom.
        C'est le premier écran, ça prend une minute.
      </p>
      <p style="margin:0;font-size:16px;line-height:1.5;">Bon travail,<br>${escapeHtml(options.senderName)}</p>
    </td></tr>
  </table>
</body>
</html>`;

  return {
    subject: `Ton accès à « ${options.courseTitle} »`,
    text,
    html,
  };
}

/** Les cinq caractères que le HTML ne pardonne pas dans une valeur. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
