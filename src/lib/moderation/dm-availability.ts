import type { SyncScope } from "./sync-scope";

/**
 * La mémoire d'une boîte de messages privés : ce que le passage précédent en
 * a appris, relu par le suivant.
 *
 * Trois états, tous portés par `channel_connections.last_error` — aucune
 * colonne de plus, c'est le **préfixe** du texte qui dit l'état, et c'est
 * `sync.ts` qui lit et écrit la ligne. Module **pur**.
 *
 *   • **refusée** — Meta n'a servi la boîte à aucun palier du budget. C'est
 *     un avertissement, pas une panne : les commentaires du canal sont
 *     passés. À l'ouverture de l'écran (portée `jour`), retenter coûterait
 *     45 s pour le même refus dans une route qui n'en a que soixante : on ne
 *     retente pas, et seul le passage complet — la nuit, ou « Tout relever »
 *     — le fait.
 *   • **en-têtes seulement** — Meta n'a servi la boîte qu'au palier des
 *     en-têtes nus, fil par fil ensuite. Sans cette mémoire, le relevé du
 *     jour, qui n'a droit qu'à un palier, repartait du listing développé,
 *     échouait, déclarait la boîte refusée et ne la relisait plus qu'à la
 *     nuit : une boîte qui **marchait** chaque heure passait à un relevé par
 *     jour. Le jour démarre donc directement à ce palier.
 *   • **reportée** — le passage n'avait plus le temps de la demander. Rien
 *     n'a été appris : ce n'est ni un refus ni une réussite, et le relevé
 *     suivant la redemande normalement.
 */

/** Le début exact de l'avertissement écrit en base — ne pas le reformuler. */
export const DM_UNAVAILABLE_PREFIX = "Messages privés indisponibles";

/**
 * L'avertissement écrit quand la boîte est refusée jusqu'au palier minimum.
 *
 * Sur Instagram, le refus a un geste à vérifier côté Meta — sans affirmer
 * que c'en est la cause : la boîte d'un compte professionnel ne se lit par
 * l'API que si le compte a autorisé l'accès aux messages aux outils
 * connectés. Messenger n'a pas ce réglage.
 */
export function dmUnavailableWarning(channel: "instagram" | "facebook"): string {
  const base = `${DM_UNAVAILABLE_PREFIX} : Meta refuse de servir la boîte de cette Page, même réduite au minimum.`;
  if (channel === "instagram") {
    return `${base} Sur Instagram, vérifier que « Autoriser l'accès aux messages » est activé dans l'app (Paramètres → Messages et réponses aux stories → Outils connectés), puis relancer un relevé complet. Les commentaires, eux, remontent normalement.`;
  }
  return `${base} Les commentaires, eux, remontent normalement.`;
}

/**
 * Vrai quand le dernier passage a déclaré la boîte indisponible.
 *
 * `includes` et non `startsWith` : sur Instagram, `last_error` peut porter
 * d'abord l'avertissement de volume des publications, puis celui de la boîte.
 */
export function dmWasRefused(lastError: string | null): boolean {
  return lastError?.includes(DM_UNAVAILABLE_PREFIX) ?? false;
}

/**
 * Vrai quand le passage doit relever la boîte privée. Toujours en `complet` ;
 * en `jour`, jamais après un refus — l'avertissement reste affiché, il n'a
 * simplement pas été redemandé.
 */
export function shouldPullDirectMessages(input: {
  scope: SyncScope;
  lastError: string | null;
}): boolean {
  if (input.scope === "complet") return true;
  return !dmWasRefused(input.lastError);
}

/** Le début exact de la note écrite quand seuls les en-têtes ont passé. */
export const DM_HEADERS_ONLY_PREFIX = "Messages privés : en-têtes seulement";

/**
 * La note écrite quand la boîte n'a été servie qu'au palier des en-têtes.
 * Courte : elle s'affiche en tête d'inbox, et ce qu'elle dit à l'humain est
 * que la boîte remonte — fil par fil, mais elle remonte.
 */
export function dmHeadersOnlyNote(): string {
  return `${DM_HEADERS_ONLY_PREFIX} — Meta ne sert cette boîte que fil par fil.`;
}

export function dmServedByHeaders(lastError: string | null): boolean {
  return lastError?.includes(DM_HEADERS_ONLY_PREFIX) ?? false;
}

/**
 * Vrai quand l'escalier du relevé doit **démarrer** au palier des en-têtes
 * au lieu du listing développé. Seulement le jour : la nuit repart du haut,
 * c'est la passe de réparation, et elle a le budget pour redécouvrir qu'une
 * boîte sert de nouveau le listing.
 */
export function startsAtHeaders(input: {
  scope: SyncScope;
  lastError: string | null;
}): boolean {
  return input.scope === "jour" && dmServedByHeaders(input.lastError);
}

/**
 * L'avertissement d'une boîte que le passage n'a pas eu le temps de
 * demander. Il ne porte **aucun** des deux préfixes ci-dessus : rien n'a été
 * appris, et le relevé suivant doit la redemander comme si de rien n'était.
 */
export const DM_DEFERRED_WARNING =
  "Messages privés reportés au passage suivant : le relevé n'avait plus le temps de les demander.";
