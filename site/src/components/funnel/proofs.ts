import type { CaseStudy, ProofStat } from "@/i18n/types";
import { CASE_VISUALS } from "@/lib/cases";

/**
 * Le volet de preuves du questionnaire : chaque chiffre sourcé du
 * dictionnaire, posé sur une vraie publication de son client quand il en a
 * une. Le rapprochement se fait par le nom du client, celui des cas : un
 * chiffre ne s'affiche jamais sur le visuel d'un autre client — sans
 * publication à lui, il garde le fond de la Profondeur.
 */
export type ProofSlide = ProofStat & {
  /** L'affiche de la publication, ou `null` : le fond reste celui de la Profondeur. */
  poster: string | null;
  /** Le compte qui a publié, l'étiquette du visuel. */
  handle: string | null;
};

/** La publication retenue par cas : la plus lisible une fois assombrie, sans texte incrusté. */
const PROOF_POSTERS: Record<string, string> = {
  bondet: "/cas/bondet-solaire.webp",
  anmf: "/cas/anmf-spot.webp",
  iway: "/cas/iway-f1.webp",
};

export function proofSlides(panel: readonly ProofStat[], cases: readonly CaseStudy[]): ProofSlide[] {
  return panel.map((proof) => {
    const caseId = cases.find((item) => item.client === proof.client)?.id;
    const visuals = caseId ? (CASE_VISUALS[caseId] ?? []) : [];
    const wanted = caseId ? PROOF_POSTERS[caseId] : undefined;
    const visual = visuals.find((item) => item.poster === wanted) ?? visuals[0] ?? null;
    return { ...proof, poster: visual?.poster ?? null, handle: visual?.handle ?? null };
  });
}
