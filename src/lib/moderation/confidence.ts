import type { Draft, DraftSource } from "./types";

/**
 * Le seuil en dessous duquel une proposition ne s'affiche pas.
 *
 * Une réponse que le modèle donne à 20 % de confiance n'est pas une aide :
 * c'est un texte plausible qu'il faut relire mot à mot, et on finit par la
 * valider par réflexe. En dessous, l'écran montre plutôt ce qui manque — une
 * entrée de FAQ — et le bouton pour l'ajouter.
 *
 * **Le seuil porte sur la confiance seule, jamais sur l'absence de source
 * FAQ.** Beaucoup de réponses légitimes n'en ont aucune : un message privé se
 * répond « Bonjour … L'équipe X » sans qu'aucune entrée ne couvre le sujet, et
 * la consigne est que le modèle propose **toujours** dans ce cas. Une
 * proposition sans source se signale, elle ne se cache pas.
 */
export const CONFIDENCE_THRESHOLD = 0.4;

export type DraftStanding = {
  /** La proposition s'affiche-t-elle ? */
  proposable: boolean;
  /** S'appuie-t-elle sur au moins une entrée de FAQ citée ? */
  grounded: boolean;
  sources: DraftSource[];
};

export function standingOf(draft: Draft | null): DraftStanding {
  const sources = (draft?.sources ?? []) as DraftSource[];
  if (!draft) return { proposable: false, grounded: false, sources };

  // Une confiance absente n'est pas une confiance nulle : le modèle n'a rien
  // dit, ce qui arrive sur les brouillons écrits avant le champ. On affiche.
  const confidence = draft.confidence ?? 1;
  return {
    proposable: confidence >= CONFIDENCE_THRESHOLD,
    grounded: sources.length > 0,
    sources,
  };
}
