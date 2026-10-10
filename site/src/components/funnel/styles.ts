/**
 * Les classes partagées des écrans du tunnel — toutes posées sur les tokens.
 *
 * Les boutons prennent les utilitaires de la charte (`btn-primary`,
 * `btn-glass`, `styles/buttons.css`) : au survol ils s'éclaircissent et
 * s'allument d'un liseré Signal, sans bouger (r-19). Ici ne s'ajoutent que
 * la forme et la taille.
 */

const BUTTON_BASE =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-pill px-6 type-body font-semibold disabled:pointer-events-none disabled:opacity-50 sm:w-auto";

export const BUTTON_PRIMARY = `${BUTTON_BASE} btn-primary`;

export const BUTTON_SECONDARY = `${BUTTON_BASE} btn-glass`;

/** L'action d'un écran, en bas à droite de la carte : l'aplat d'encre, à sa largeur, jamais pleine ligne. */
export const CTA =
  "btn-primary inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-pill px-6 type-body font-semibold disabled:pointer-events-none disabled:opacity-40";

/** Un bouton discret, sans fond : la navigation secondaire (retour, semaine). */
export const BUTTON_GHOST =
  "inline-flex h-10 items-center gap-2 rounded-md px-3 type-small text-text-2 transition duration-(--motion) ease-(--ease) hover:bg-field hover:text-text disabled:cursor-not-allowed disabled:opacity-40";

/** Un lien textuel discret, pour « je préfère quand même échanger ». */
export const LINK_QUIET = "type-small text-text-2 underline underline-offset-4 transition duration-(--motion) ease-(--ease) hover:text-text";

export const FIELD =
  "h-12 w-full rounded-md border border-line-strong bg-field px-4 type-body text-text placeholder:text-text-3 transition duration-(--motion) ease-(--ease) hover:border-line-strong";

export const LABEL = "type-small font-medium text-text-2";
