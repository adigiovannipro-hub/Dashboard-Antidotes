import type { StatusGroup } from "./types";

/**
 * Pourquoi la liste est vide — et il y a quatre raisons, pas une.
 *
 * « Aucune conversation ne correspond à ces filtres » était affiché dans les
 * quatre cas. C'est faux dans trois d'entre eux, et surtout inutile : la
 * phrase ne dit jamais quoi faire. Un compte jamais branché, une boîte
 * réellement vide, un travail terminé et un filtre trop serré demandent
 * chacun un geste différent — ou aucun, et c'est une bonne nouvelle.
 *
 * Pure et testée : c'est un arbre de décision, pas du rendu.
 */

export type EmptyState = {
  /** La phrase principale. */
  title: string;
  /** Ce qu'il y a à faire, ou à comprendre. Vide quand il n'y a rien à faire. */
  hint: string;
  /** Le geste proposé, quand il existe. */
  action: "brancher" | "relever" | "reinitialiser" | null;
};

export function describeEmptyState(input: {
  /** Nombre de canaux branchés, tous clients confondus. */
  connections: number;
  /** Un relevé a-t-il déjà eu lieu ? */
  everPolled: boolean;
  /** Des filtres autres que le segment sont-ils posés ? */
  filtered: boolean;
  segment: StatusGroup;
}): EmptyState {
  if (input.connections === 0) {
    return {
      title: "Aucun compte branché",
      hint: "Rien ne peut être relevé tant qu'un compte social n'est pas rattaché. Cela se fait depuis Connexions, dans le Reporting du client.",
      action: "brancher",
    };
  }

  if (!input.everPolled) {
    return {
      title: "Jamais relevé",
      hint: "Les comptes sont branchés, le premier passage n'a pas encore eu lieu.",
      action: "relever",
    };
  }

  if (input.filtered) {
    return {
      title: "Rien avec ces filtres",
      hint: "Un réseau, un client ou une bascule écarte tout le reste.",
      action: "reinitialiser",
    };
  }

  if (input.segment === "a-traiter") {
    return {
      title: "Tout est traité",
      hint: "",
      action: null,
    };
  }

  return {
    title: input.segment === "en-attente" ? "Rien en attente" : "Rien de traité",
    hint: "",
    action: null,
  };
}
