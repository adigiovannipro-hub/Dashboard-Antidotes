/**
 * La signature des mails de facturation — un seul endroit pour tous les
 * envois qui partent de la boîte connectée.
 *
 * Deux formes, et les deux partent ensemble : le message est envoyé en
 * `multipart/alternative`, le client de messagerie choisit ce qu'il sait
 * afficher. Le texte n'est donc pas un pis-aller, c'est la version qui
 * arrive intacte partout — messagerie en mode texte, aperçu de notification,
 * client d'entreprise qui coupe le HTML.
 *
 * `SIGNATURE_HTML` à `null` : les mails partent en texte seul, exactement
 * comme avant. Y coller la signature Gmail habituelle suffit à basculer tout
 * le dispositif — rien d'autre à changer.
 *
 * Deux précautions le jour où on la colle :
 *
 *   • **les images doivent être des URL publiques** (`https://…`). Une image
 *     collée dans Gmail devient un `cid:` qui ne veut rien dire hors de son
 *     message d'origine, et une `data:` est bloquée par la plupart des
 *     clients ;
 *   • **pas de `<style>` ni de classes** : seul le style en ligne
 *     (`style="…"`) survit à un client de messagerie.
 */

/** La signature en texte, celle qui arrive partout. */
export const SIGNATURE_TEXT = `À dispo,

Alessandro DI GIOVANNI
Social Media Consultant & Creator Agent
+33 6 79 77 92 35
a.digiovanni.pro@gmail.com
https://bit.ly/2Ku3Pwu`;

/**
 * La signature en HTML. `null` tant qu'elle n'a pas été fournie — le mail
 * part alors en texte seul.
 */
export const SIGNATURE_HTML: string | null = `<table cellpadding="0" cellspacing="0" border="0" width="600px" style="color: rgb(0, 0, 0); font-variant-caps: normal; vertical-align: -webkit-baseline-middle; font-size: small; font-family: Arial;"><tbody><tr><td style="padding-bottom: 15px;"><div style="margin: 0px; font-size: 12px;">À dispo,</div></td></tr><tr><td><table cellpadding="0" cellspacing="0" border="0" style="vertical-align: -webkit-baseline-middle; font-size: small;"><tbody><tr><td width="150" style="vertical-align: middle;"><span style="margin-right: 20px; display: block;"><img src="https://image.noelshack.com/fichiers/2026/01/5/1767349579-cropped-circle-image-30x30.png" role="presentation" width="130" style="max-width: 130px;"></span></td><td style="vertical-align: middle;"><h2 style="margin: 0px; font-size: 16px; line-height: 24px;">Alessandro DI GIOVANNI</h2><div style="margin: 0px; font-size: 12px; line-height: 20px; white-space: nowrap;">Social Media Consultant &amp; Creator Agent</div><div style="margin: 0px; font-size: 12px; line-height: 20px;">Media Kit : <a href="https://shm.to/BjXi8DC" style="color: rgb(0, 0, 0);">Hamza Sdt</a> - <a href="https://shm.to/XHMrZGw" style="color: rgb(0, 0, 0);">Claire Sgr</a></div></td><td width="30" aria-label="Vertical Spacer"><div style="width: 30px;"></div></td><td width="1" aria-label="Divider" style="width: 1px; height: auto; border-bottom: medium; border-left: 1px solid rgb(191, 252, 166);"></td><td width="30" aria-label="Vertical Spacer"><div style="width: 30px;"></div></td><td style="vertical-align: middle;"><table cellpadding="0" cellspacing="0" border="0" style="vertical-align: -webkit-baseline-middle; font-size: small; line-height: 1;"><tbody><tr style="vertical-align: middle; height: 26px;"><td width="24" style="vertical-align: middle;"><table cellpadding="0" cellspacing="0" border="0" style="vertical-align: -webkit-baseline-middle; font-size: small; width: 24px;"><tbody><tr><td style="vertical-align: bottom;"><span style="display: inline-block; background-color: rgb(191, 252, 166);"><img src="https://cdn2.hubspot.net/hubfs/53/tools/email-signature-generator/icons/phone-icon-dark-2x.png" alt="mobilePhone" width="16" style="display: block; background-image: linear-gradient(rgb(191, 252, 166), rgb(191, 252, 166));"></span></td></tr></tbody></table></td><td style="padding: 0px;"><a href="tel:+33679779235" style="text-decoration: none; color: rgb(0, 0, 0); font-size: 12px;">+33679779235</a></td></tr><tr style="vertical-align: middle; height: 26px;"><td width="24" style="vertical-align: middle;"><table cellpadding="0" cellspacing="0" border="0" style="vertical-align: -webkit-baseline-middle; font-size: small; width: 24px;"><tbody><tr><td style="vertical-align: bottom;"><span style="display: inline-block; background-color: rgb(191, 252, 166);"><img src="https://cdn2.hubspot.net/hubfs/53/tools/email-signature-generator/icons/email-icon-dark-2x.png" alt="emailAddress" width="16" style="display: block; background-image: linear-gradient(rgb(191, 252, 166), rgb(191, 252, 166));"></span></td></tr></tbody></table></td><td style="padding: 0px;"><a href="mailto:a.digiovanni.pro@gmail.com" style="text-decoration: none; color: rgb(0, 0, 0); font-size: 12px;">a.digiovanni.pro@gmail.com</a></td></tr><tr style="vertical-align: middle; height: 26px;"><td width="24" style="vertical-align: middle;"><table cellpadding="0" cellspacing="0" border="0" style="vertical-align: -webkit-baseline-middle; font-size: small; width: 24px;"><tbody><tr><td style="vertical-align: bottom;"><span style="display: inline-block; background-color: rgb(191, 252, 166);"><img src="https://cdn2.hubspot.net/hubfs/53/tools/email-signature-generator/icons/link-icon-dark-2x.png" alt="website" width="16" style="display: block; background-image: linear-gradient(rgb(191, 252, 166), rgb(191, 252, 166));"></span></td></tr></tbody></table></td><td style="padding: 0px;"><a href="https://bit.ly/2Ku3Pwu" style="text-decoration: none; color: rgb(0, 0, 0); font-size: 12px;">https://bit.ly/2Ku3Pwu</a></td></tr></tbody></table></td></tr></tbody></table></td></tr><tr><td></td></tr><tr><td></td></tr><tr><td colspan="3" style="max-width: 300px; font-size: 12px; padding-top: 1rem; text-align: center;"><div class="legal-content"><p style="font-size: inherit; margin: 0px;"></p><p style="font-size: inherit; margin: 0px;"></p></div></td></tr></tbody></table>`;

/** Le texte d'un corps de mail, échappé pour tenir dans du HTML. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * La version HTML d'un corps de mail écrit en texte.
 *
 * `null` quand aucune signature HTML n'est posée : sans elle, une version
 * HTML n'apporterait rien qu'un risque d'affichage de plus.
 *
 * Le corps est repris tel quel, sauts de ligne compris, et la signature
 * texte en est retirée : c'est sa version riche qui la remplace.
 */
export function bodyAsHtml(body: string): string | null {
  if (!SIGNATURE_HTML) return null;

  const withoutSignature = body.replace(SIGNATURE_TEXT, "").trimEnd();
  const paragraphs = escapeHtml(withoutSignature)
    .split(/\n{2,}/)
    .map((block) => `<p style="margin:0 0 1em">${block.replace(/\n/g, "<br>")}</p>`)
    .join("");

  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.55;color:#1a1a1a">${paragraphs}${SIGNATURE_HTML}</div>`;
}
