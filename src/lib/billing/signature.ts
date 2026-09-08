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
 *   • **seul le style en ligne (`style="…"`) est garanti**. La signature
 *     porte un `<style>` en tête — la requête média qui laisse les libellés
 *     revenir à la ligne sous 480 px. C'est un bonus : la plupart des
 *     clients le suppriment, et la carte se lit sans lui.
 */

/** La signature en texte, celle qui arrive partout. */
export const SIGNATURE_TEXT = `À dispo,

Alessandro DI GIOVANNI
Consultant Social Media & Influence Freelance
10 Rue Félix Brun, 69007 Lyon
+33 6 79 77 92 35
a.digiovanni.pro@gmail.com
https://alessandrodigiovanni.com`;

/**
 * La signature en HTML. `null` tant qu'elle n'a pas été fournie — le mail
 * part alors en texte seul.
 */
export const SIGNATURE_HTML: string | null = `<style>@media only screen and (max-width:480px) { .mailbutler-signature b { white-space: normal !important; } .mailbutler-signature em { white-space: normal !important; } .mailbutler-signature i { white-space: normal !important; } .mailbutler-signature li { white-space: normal !important; } .mailbutler-signature span { white-space: normal !important; } .mailbutler-signature strong { white-space: normal !important; } } </style> <div id="MailbutlerSignature" class="mailbutler-signature ltr" data-signature-id="d62893bd-b283-4b3f-a272-60f702f375ab" style="-moz-box-sizing: border-box; -ms-text-size-adjust: 100%; -webkit-box-sizing: border-box; -webkit-text-size-adjust: 100%; box-sizing: border-box; margin-top: 0; margin-right: 0; margin-bottom: 0; margin-left: 0; min-width: 100%; padding-top: 0; padding-right: 0; padding-bottom: 0; padding-left: 0; width: 100% !important;">  <!--[if mso]> <style type="text/css"> table, td, span, b, a, li, p { font-family:Lucida Sans Unicode, sans-serif !important; } </style> <![endif]-->   <table width="100%" style="border-collapse: collapse; border-spacing: 0; margin-top: 0 !important; margin-right: 0 !important; margin-bottom: 0 !important; margin-left: 0 !important; mso-table-lspace: 0 !important; mso-table-rspace: 0 !important; padding-top: 0; padding-right: 0; padding-bottom: 0; padding-left: 0; table-layout: fixed !important; text-align: left; vertical-align: top; width: 100%;"><tr style="padding-top: 0; padding-right: 0; padding-bottom: 0; padding-left: 0; vertical-align: top;" align="left"><td style="-moz-hyphens: auto; -webkit-hyphens: auto; border-collapse: collapse !important; color: #000000; font-family: Lucida Sans Unicode,Helvetica,Arial,sans-serif; font-size: 9px; font-weight: 400; hyphens: auto; line-height: 1.5; margin-top: 0; margin-right: 0; margin-bottom: 0; margin-left: 0; mso-table-lspace: 0 !important; mso-table-rspace: 0 !important; padding-top: 0; padding-right: 0; padding-bottom: 0; padding-left: 0; word-wrap: break-word;" align="left" valign="top"> <div class="pb-8" style="padding-bottom: 8px;"> <p class="mb-2" style="color: #000000; font-size: 9px; font-weight: 400; line-height: inherit; margin-top: 0; margin-right: 0; margin-left: 0; margin-bottom: 2px; padding-top: 0; padding-right: 0; padding-bottom: 0; padding-left: 0;" align="left"><b class="larger" style="color: #000000; font-size: 130%; line-height: inherit; margin-bottom: 0; white-space: nowrap;">Alessandro DI GIOVANNI</b></p> <p style="color: #000000; font-size: 9px; font-weight: 400; line-height: inherit; margin-top: 0; margin-right: 0; margin-left: 0; margin-bottom: 0; padding-top: 0; padding-right: 0; padding-bottom: 0; padding-left: 0;" align="left"> <span style="border-top-width: 0; border-right-width: 0; border-bottom-width: 0; border-left-width: 0; color: #000000; font-size: 9px; line-height: inherit; margin-top: 0; margin-right: 0; margin-left: 0; margin-bottom: 0; padding-top: 0; padding-right: 0; padding-bottom: 0; padding-left: 0; white-space: nowrap;">Consultant Social Media &amp; Influence Freelance</span>  </p>   <p style="color: #000000; font-size: 9px; font-weight: 400; line-height: inherit; margin-top: 0; margin-right: 0; margin-left: 0; margin-bottom: 0; padding-top: 0; padding-right: 0; padding-bottom: 0; padding-left: 0;" align="left">  <span style="border-top-width: 0; border-right-width: 0; border-bottom-width: 0; border-left-width: 0; color: #000000; font-size: 9px; line-height: inherit; margin-top: 0; margin-right: 0; margin-left: 0; margin-bottom: 0; padding-top: 0; padding-right: 0; padding-bottom: 0; padding-left: 0; white-space: nowrap;"><a class="primary-color" href="https://alessandrodigiovanni.com" target="_blank" rel="noopener" style="color: #7D9BD0 !important; font-size: 9px; font-weight: 400; line-height: inherit; margin-top: 0; margin-right: 0; margin-left: 0; margin-bottom: 0; padding-top: 0; padding-right: 0; padding-bottom: 0; padding-left: 0; text-align: left; text-decoration: none;"><b class="primary-color" style="color: #7D9BD0 !important; font-size: 9px; line-height: inherit; margin-bottom: 0; white-space: nowrap;">website</b></a></span>   <!--[if mso]> <b style="color: #000000; font-size: 12px;">|</b> <![endif]--> <span class="mb-signature-separator" style="border-top-width: 0; border-right-width: 0; border-bottom-width: 0; border-left-width: 2px; border-left-color: #000; border-left-style: solid; color: #000000; font-size: 9px; line-height: inherit; margin-top: 0; margin-bottom: 0; margin-left: 4px; margin-right: 6px; padding-top: 0; padding-right: 0; padding-bottom: 0; padding-left: 0; white-space: nowrap;"></span>   <span class="border_left" style="border-top-width: 0; border-right-width: 0; border-bottom-width: 0; border-left-width: 0; color: #000000; font-size: 9px; line-height: inherit; margin-top: 0; margin-right: 0; margin-left: 0; margin-bottom: 0; padding-top: 0; padding-right: 0; padding-bottom: 0; padding-left: 0; white-space: nowrap;"><a class="primary-color" href="mailto:a.digiovanni.pro@gmail.com" style="color: #7D9BD0 !important; font-size: 9px; font-weight: 400; line-height: inherit; margin-top: 0; margin-right: 0; margin-left: 0; margin-bottom: 0; padding-top: 0; padding-right: 0; padding-bottom: 0; padding-left: 0; text-align: left; text-decoration: none;"><b class="primary-color" style="color: #7D9BD0 !important; font-size: 9px; line-height: inherit; margin-bottom: 0; white-space: nowrap;">mail</b> </a></span>  </p>  </div> <!--[if mso]> <table role="presentation" border="0" cellspacing="8" cellpadding="4" width="100%" style="width:100%;"> <tr> <td width="68" valign="top"> <![endif]--><div class="mb-signature-column pr-12 pb-8" style="float: left; max-width: 68px; padding-bottom: 8px; padding-right: 12px;">  <a href="https://bit.ly/3qyOy4M" target="_blank" rel="noopener" style="color: #000000; font-size: 9px; font-weight: 400; line-height: inherit; margin-top: 0; margin-right: 0; margin-left: 0; margin-bottom: 0; padding-top: 0; padding-right: 0; padding-bottom: 0; padding-left: 0; text-align: left; text-decoration: none;"><img src="https://images.mailbutler.io/u/56d1508a-5daa-49fd-9df1-eb898c78e648/d62893bd-b283-4b3f-a272-60f702f375ab__image.png?version=1692189322" srcset="https://images.mailbutler.io/u/56d1508a-5daa-49fd-9df1-eb898c78e648/d62893bd-b283-4b3f-a272-60f702f375ab__image_2x.png?version=1692189322 2x" alt="Signature Image" title="Signature Image" width="68" height="68" style="-ms-interpolation-mode: bicubic; border-top-style: none; border-right-style: none; border-bottom-style: none; border-left-style: none; border-radius: 32.98px; clear: both; display: block; height: auto; max-width: 100%; outline: 0; text-decoration: none; width: 68px;"> </a>  </div> <!--[if mso]> </td><td valign="top"> <![endif]--><div class="mb-signature-column" style="float: left; max-width: 480px;"> <div class="mb-signature-field-list mb-signature-text-bullets" style="margin-top: 0; margin-right: 0; margin-bottom: 0; margin-left: 0; padding-top: 0; padding-right: 0; padding-bottom: 0; padding-left: 0;">  <div class="mb-signature-list-item" style="margin-bottom: 2px; margin-top: 2px;"> <b class="primary-color" style="color: #7D9BD0 !important; font-size: 9px; line-height: inherit; margin-bottom: 0; margin-right: 4px; white-space: nowrap;">a:</b><span style="border-top-width: 0; border-right-width: 0; border-bottom-width: 0; border-left-width: 0; color: #000000; font-size: 9px; line-height: inherit; margin-top: 0; margin-right: 0; margin-left: 0; margin-bottom: 0; padding-top: 0; padding-right: 0; padding-bottom: 0; padding-left: 0; white-space: nowrap;">10 Rue Félix Brun, 69007 Lyon </span> </div>     <div class="mb-signature-list-item" style="margin-bottom: 2px; margin-top: 2px;"> <b class="primary-color" style="color: #7D9BD0 !important; font-size: 9px; line-height: inherit; margin-bottom: 0; margin-right: 4px; white-space: nowrap;">m:</b> <a href="tel:+33679779235" style="color: #000000; font-size: 9px; font-weight: 400; line-height: inherit; margin-top: 0; margin-right: 0; margin-left: 0; margin-bottom: 0; padding-top: 0; padding-right: 0; padding-bottom: 0; padding-left: 0; text-align: left; text-decoration: none;"><span style="border-top-width: 0; border-right-width: 0; border-bottom-width: 0; border-left-width: 0; color: #000000; font-size: 9px; line-height: inherit; margin-top: 0; margin-right: 0; margin-left: 0; margin-bottom: 0; padding-top: 0; padding-right: 0; padding-bottom: 0; padding-left: 0; white-space: nowrap;">+33679779235</span></a> </div>  </div> <div class="clearfix" style="clear: both;"></div> <div class="social-icons mt-10" style="margin-top: 10px;">     <!--[if mso]> <table role="presentation" border="0" cellspacing="4" cellpadding="4"> <tr> <![endif]-->     <!--[if mso]> <td valign="middle"> <![endif]--><div style="border-top-width: 2px; border-right-width: 2px; border-bottom-width: 2px; border-left-width: 2px; border-top-color: #7D9BD0; border-right-color: #7D9BD0; border-bottom-color: #7D9BD0; border-left-color: #7D9BD0; border-top-style: solid; border-right-style: solid; border-bottom-style: solid; border-left-style: solid; border-radius: 5.329999999999997px; float: left; margin-bottom: 2px; margin-left: 20px; margin-right: 2px; padding-top: 3px; padding-right: 12px; padding-left: 12px; padding-bottom: 2px;"><a href="https://bit.ly/3qyOy4M" target="_blank" rel="noopener" style="color: #000000; font-size: 9px; font-weight: 400; line-height: inherit; margin-top: 0; margin-right: 0; margin-left: 0; margin-bottom: 0; padding-top: 0; padding-right: 0; padding-bottom: 0; padding-left: 0; text-align: left; text-decoration: none;"><span style="border-top-width: 0; border-right-width: 0; border-bottom-width: 0; border-left-width: 0; color: #000000; font-size: 9px; line-height: inherit; margin-top: 0; margin-right: 0; margin-left: 0; margin-bottom: 0; padding-top: 0; padding-right: 0; padding-bottom: 0; padding-left: 0; white-space: nowrap;">Ils m’ont fait confiance</span></a></div> <!--[if mso]> </td> <![endif]-->   <div style="border-top-style: none; border-right-style: none; border-bottom-style: none; border-left-style: none; float: left; height: 2px; margin-top: 0; margin-left: 0; margin-bottom: 2px; margin-right: 2px; padding-top: 0; padding-right: 0; padding-left: 0; padding-bottom: 2px; width: 100%;"></div> <!--[if mso]> </tr></table> <![endif]--> </div> </div> <!--[if mso]> </td></tr></table> <![endif]-->  </td></tr></table>  <!-- prevent Gmail on iOS font size manipulation --><div style="display: none; white-space: nowrap; font-style: normal; font-variant: normal; font-weight: normal; font-size: 15px; font-family: courier; line-height: 0;">                                                           </div> </div>`;

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
 * La carte de signature, telle qu'elle part après la pièce jointe.
 *
 * Elle ne porte pas « À dispo, » : la formule vit dans `SIGNATURE_TEXT` et
 * ferme le message, avant le PDF. Rien à découper ici — la version
 * précédente amputait la première rangée du tableau parce que la formule y
 * était collée.
 */
function signatureCardHtml(): string | null {
  return SIGNATURE_HTML;
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

  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.55;color:#1a1a1a">${paragraphs}</div>`;
}
