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

Alessandro Di Giovanni
Social Media Consultant & Creator Agent
+33 6 79 77 92 35 — a.digiovanni.pro@gmail.com`;

/**
 * La signature en HTML. `null` tant qu'elle n'a pas été fournie — le mail
 * part alors en texte seul.
 */
export const SIGNATURE_HTML: string | null = null;

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
