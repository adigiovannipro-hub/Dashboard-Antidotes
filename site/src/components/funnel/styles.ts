/**
 * Les classes partagées des écrans du tunnel — toutes posées sur les tokens.
 *
 * Le bouton primaire est un aplat clair (`bg-text`) à l'encre sombre : jamais
 * de blanc sur l'iridescence, réservée aux fonds et aux marques.
 */

const BUTTON_BASE =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-md px-5 type-body font-medium transition duration-(--motion) ease-(--ease) disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto";

export const BUTTON_PRIMARY = `${BUTTON_BASE} bg-text text-text-on-light hover:bg-accent-ink-strong`;

export const BUTTON_SECONDARY = `${BUTTON_BASE} border border-glass-border bg-glass-strong text-text hover:bg-glass`;

/** Un bouton discret, sans fond : la navigation secondaire (retour, semaine). */
export const BUTTON_GHOST =
  "inline-flex h-10 items-center gap-2 rounded-md px-3 type-small text-text-2 transition duration-(--motion) ease-(--ease) hover:bg-glass hover:text-text disabled:cursor-not-allowed disabled:opacity-40";

/** Un lien textuel discret, pour « je préfère quand même échanger ». */
export const LINK_QUIET = "type-small text-text-2 underline underline-offset-4 transition duration-(--motion) ease-(--ease) hover:text-text";

export const FIELD =
  "h-12 w-full rounded-md border border-glass-border bg-ink-1 px-4 type-body text-text placeholder:text-text-3 transition duration-(--motion) ease-(--ease) hover:border-line-strong";

export const LABEL = "type-small font-medium text-text-2";
