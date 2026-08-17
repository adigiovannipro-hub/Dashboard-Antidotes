import type { MetricId } from "@/lib/metrics/types";
import type { ReportingNetwork } from "./networks";

/**
 * Quelles mesures chaque onglet du Reporting affiche.
 *
 * Le payant et l'organique ne répondent pas à la même question. Le premier
 * dit « combien ça rapporte pour ce que ça coûte » : la conversion et son
 * coût y dominent. Le second dit « est-ce qu'on intéresse » : la portée et
 * l'engagement, sans un euro à afficher.
 *
 * Reprendre le tableau du payant sur l'organique aurait donné dix cartes dont
 * six à `—` en permanence, ce qui se lit comme une panne plutôt que comme une
 * absence de sens.
 *
 * Les listes sont volontairement séparées du composant : c'est le contrat que
 * le connecteur doit remplir, et il se lit sans ouvrir une seule vue.
 */

/**
 * Le chiffre héros de chaque onglet — un par vue, celui qui répond seul.
 *
 * En organique il n'y a pas de ROAS : c'est le **taux d'engagement** qui dit
 * si le contenu a porté — la portée dit combien ont vu, l'engagement dit
 * combien s'en sont souciés.
 */
export const HERO_METRIC: Record<ReportingNetwork, MetricId> = {
  "meta-ads": "roas",
  instagram: "engagementRate",
  facebook: "engagementRate",
};

export const KPI_SETS: Record<ReportingNetwork, MetricId[]> = {
  "meta-ads": [
    "spend",
    "earn",
    "purchases",
    "cpa",
    "impressions",
    "clicks",
    "frequency",
    "cpm",
    "ctr",
    "landingPageViews",
  ],
  /* Organique : rien de monétaire, pas de répétition — elle ne dit rien d'un
     feed. L'ordre suit la lecture d'un rapport social : combien de monde,
     combien de fois, et ce qu'ils en ont fait. */
  /* Pas de portée : Meta ne la rend plus sur tous les types de média, et une
     tuile à moitié vide vaut moins qu'une tuile absente. Elle reste le
     dénominateur du taux d'engagement, où son absence se rattrape sur les
     vues.

     Les deux réseaux organiques portent **la même série**, à l'exception des
     enregistrements : Facebook ne les expose pas, et une carte
     invariablement à zéro se lit comme une contre-performance plutôt que
     comme une absence de mesure. */
  instagram: ["impressions", "videoViews", "likes", "comments", "saves", "shares"],
  facebook: ["impressions", "videoViews", "likes", "comments", "shares"],
};

/** Les découpages d'audience ont-ils un sens sur cet onglet ? */
export function hasPersona(network: ReportingNetwork): boolean {
  // Âge, genre et région viennent du breakdown **publicitaire**. Sur
  // l'organique, Instagram ne les donne que pour les abonnés, et Facebook pas
  // du tout : les afficher au même endroit laisserait croire à la même
  // mesure.
  return network === "meta-ads";
}

/** Le tableau de détail : par ad set en payant, par publication en organique. */
export function detailTitle(network: ReportingNetwork): string {
  return network === "meta-ads"
    ? "Performance par ad set"
    : "Performance par publication";
}
