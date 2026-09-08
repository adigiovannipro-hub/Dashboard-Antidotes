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
a.digiovanni.pro@gmail.com`;

/**
 * La signature en HTML. `null` tant qu'elle n'a pas été fournie — le mail
 * part alors en texte seul.
 */
export const SIGNATURE_HTML: string | null = `<style>@media only screen and (max-width:480px){.sig-table{width:100% !important}.sig-col{display:block !important;width:100% !important;padding:0 !important}.sig-col-avatar{padding-bottom:12px !important}.sig-col-contact{padding-top:12px !important}.sig-div{display:none !important}.sig-nowrap{white-space:normal !important}}</style><table class="sig-table" cellpadding="0" cellspacing="0" border="0" width="620" style="width:620px;color:#000000;font-size:12px;font-family:Helvetica,Arial,sans-serif;"><tbody><tr><td class="sig-col sig-col-avatar" width="150" style="width:150px;padding:0 20px 0 0;vertical-align:middle;"><img src="cid:antidotes-avatar" alt="" width="130" height="130" style="display:block;width:130px;height:130px;border:0;"></td><td class="sig-col" style="padding:0;vertical-align:middle;"><h2 class="sig-nowrap" style="margin:0;font-size:16px;line-height:24px;font-weight:bold;font-family:Helvetica,Arial,sans-serif;color:#000000;white-space:nowrap;">Alessandro DI GIOVANNI</h2><div class="sig-nowrap" style="margin:0;font-size:12px;line-height:20px;white-space:nowrap;">Social Media Consultant &amp; Creator Agent</div></td><td class="sig-div" width="25" style="width:25px;padding:0;"></td><td class="sig-div" width="1" style="width:1px;padding:0;border-left:1px solid rgb(191,252,166);"></td><td class="sig-div" width="25" style="width:25px;padding:0;"></td><td class="sig-col sig-col-contact" style="padding:0;vertical-align:middle;"><table cellpadding="0" cellspacing="0" border="0" style="font-size:12px;font-family:Helvetica,Arial,sans-serif;"><tbody><tr><td width="16" style="width:16px;padding:0 8px 6px 0;vertical-align:middle;"><img src="cid:antidotes-icone-tel" alt="Téléphone" width="16" height="16" style="display:block;width:16px;height:16px;border:0;"></td><td class="sig-nowrap" style="padding:0 0 6px 0;vertical-align:middle;white-space:nowrap;"><a href="tel:+33679779235" style="text-decoration:none;color:#000000;font-size:12px;">+33679779235</a></td></tr><tr><td width="16" style="width:16px;padding:0 8px 0 0;vertical-align:middle;"><img src="cid:antidotes-icone-mail" alt="Adresse e-mail" width="16" height="16" style="display:block;width:16px;height:16px;border:0;"></td><td class="sig-nowrap" style="padding:0;vertical-align:middle;white-space:nowrap;"><a href="mailto:a.digiovanni.pro@gmail.com" style="text-decoration:none;color:#000000;font-size:12px;">a.digiovanni.pro@gmail.com</a></td></tr></tbody></table></td></tr></tbody></table>`;

/**
 * La formule qui ouvre la signature, et que la pièce jointe doit suivre.
 *
 * Un mail écrit à la main se lit dans cet ordre : le message, « À dispo, », la
 * facture, puis la carte de visite. La pièce jointe s'affiche là où elle
 * tombe dans le message, et la coller après la carte revenait à la reléguer
 * sous le numéro de téléphone.
 */
export const SIGNATURE_INTRO = "À dispo,";

/**
 * La signature scindée en deux : ce qui précède la pièce jointe, et la carte
 * qui la suit.
 *
 * Le corps rendu se termine par `SIGNATURE_TEXT` — les modèles la portent en
 * dur. On la retire, on garde « À dispo, » avec le message, et la carte part
 * après le PDF.
 */
export function splitAroundAttachment(body: string): {
  before: { text: string; html: string | null };
  after: { text: string; html: string | null };
} {
  const cardText = SIGNATURE_TEXT.replace(SIGNATURE_INTRO, "").trimStart();
  const beforeText = `${body.replace(SIGNATURE_TEXT, "").trimEnd()}\n\n${SIGNATURE_INTRO}`;

  /* Le corps qui précède la pièce jointe ne porte **pas** la carte : elle
     part derrière le PDF, dans `after`. La passer par `bodyAsHtml`, qui la
     concatène, l'affichait deux fois dans le même mail. */
  return {
    before: { text: beforeText, html: paragraphsAsHtml(beforeText) },
    after: { text: cardText, html: signatureCardHtml() },
  };
}

/**
 * La carte de signature sans sa première ligne — « À dispo, » est parti avec
 * le message. Le découpage se fait sur la première rangée du tableau, celle
 * qui ne porte que cette formule.
 */
function signatureCardHtml(): string | null {
  if (!SIGNATURE_HTML) return null;

  const opening = SIGNATURE_HTML.indexOf("<tbody>");
  const firstRowEnd = SIGNATURE_HTML.indexOf("</tr>", opening);
  if (opening === -1 || firstRowEnd === -1) return SIGNATURE_HTML;

  return (
    SIGNATURE_HTML.slice(0, opening + "<tbody>".length) +
    SIGNATURE_HTML.slice(firstRowEnd + "</tr>".length)
  );
}

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
  const paragraphs = paragraphsAsHtml(body);
  if (!paragraphs || !SIGNATURE_HTML) return null;

  return paragraphs.replace(/<\/div>$/, `${SIGNATURE_HTML}</div>`);
}

/**
 * Le corps seul, mis en paragraphes — sans la carte de signature.
 *
 * C'est ce qui part avant la pièce jointe. `null` quand aucune signature
 * HTML n'est posée : le mail est alors en texte seul de bout en bout, et une
 * version HTML n'apporterait qu'un risque d'affichage de plus.
 */
function paragraphsAsHtml(body: string): string | null {
  if (!SIGNATURE_HTML) return null;

  const withoutSignature = body.replace(SIGNATURE_TEXT, "").trimEnd();
  const paragraphs = escapeHtml(withoutSignature)
    .split(/\n{2,}/)
    .map((block) => `<p style="margin:0 0 1em">${block.replace(/\n/g, "<br>")}</p>`)
    .join("");

  return `<div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.55;color:#1a1a1a">${paragraphs}</div>`;
}
