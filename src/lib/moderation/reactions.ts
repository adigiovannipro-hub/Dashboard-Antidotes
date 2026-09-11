/**
 * Les commentaires qui ne demandent rien.
 *
 * « ❤️ », « 🔥🔥 », « @sophie » : sur un compte qui marche, c'est la moitié du
 * volume. Ils n'appellent pas de réponse, et leur faire écrire une phrase par
 * un modèle coûte de l'argent pour produire une banalité que personne ne
 * validera. L'Inbox les regroupe et les clôt en un geste.
 *
 * La règle : une fois les mentions retirées, il ne doit rester que des emojis,
 * de la ponctuation et des espaces — et le message doit porter **au moins** un
 * emoji ou une mention. « !!! » n'est donc pas une réaction : c'est peut-être
 * de l'agacement, et ça se lit.
 */

/** Un pseudo mentionné : lettres, chiffres, point, tiret, tiret bas. */
const MENTION = /@[\p{L}\p{N}._-]+/gu;

/** Ce qui ne compte pas comme du texte : espaces et ponctuation. */
const IGNORABLE = /[\s\p{P}]/gu;

/**
 * Les emojis et tout ce qui les habille — sélecteur de variante, liant à
 * largeur nulle, modificateurs de teinte, drapeaux régionaux.
 */
const EMOJI =
  /[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}‍️⃣]/gu;

export function isReactionOnly(text: string | null | undefined): boolean {
  if (!text) return false;

  const withoutMentions = text.replace(MENTION, " ");
  const rest = withoutMentions.replace(IGNORABLE, "").replace(EMOJI, "");
  if (rest.length > 0) return false;

  // Reste à écarter le message vide de sens : il faut un emoji, ou une
  // mention, pour que « clore sans répondre » soit le bon geste.
  const hadEmoji = EMOJI.test(text);
  EMOJI.lastIndex = 0;
  return hadEmoji || withoutMentions.trim().length === 0;
}
