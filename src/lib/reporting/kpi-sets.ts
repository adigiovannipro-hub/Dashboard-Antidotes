import type { MetricId } from "@/lib/metrics/types";
import { isPaidNetwork, type SocialReportingNetwork } from "./networks";

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
export const HERO_METRIC: Record<SocialReportingNetwork, MetricId> = {
  "meta-ads": "roas",
  instagram: "engagementRate",
  /* Fin 2025, Meta a retiré impressions et portée des publications de Page —
     pour tout le monde, quelle que soit la version d'API (vérifié sur pièce :
     `post_impressions` répond « not a valid insights metric » en v23). Sans
     dénominateur, le taux d'engagement afficherait « — » à perpétuité : les
     interactions deviennent le chiffre héros, c'est ce que Meta mesure encore. */
  facebook: "interactions",
  /* LinkedIn a sa propre définition du taux d'engagement, et on la suit :
     clics compris, rapportés aux impressions. Vérifiée sur pièce contre les
     statistiques natives de LinkedIn (ANMF, août 2026 : 6,73 % calculé ici
     contre 6,8 % affiché là-bas sur une fenêtre d'un jour plus courte).
     Prendre la définition d'Instagram — interactions sur portée — aurait
     donné 3,6 % et fait douter le client de son propre rapport. */
  linkedin: "engagementRateWithClicks",
  // Réseaux sans connecteur encore : les vues portent la vidéo, les
  // interactions portent le reste. Ces choix se rejugeront au branchement.
  tiktok: "videoViews",
  youtube: "videoViews",
  x: "interactions",
  /* Payant hors Meta : pas de pixel d'achat à espérer par défaut, le coût du
     clic est le chiffre qui se compare d'un mois à l'autre. */
  "linkedin-ads": "cpc",
  "tiktok-ads": "cpc",
};

export const KPI_SETS: Record<SocialReportingNetwork, MetricId[]> = {
  /* Plus de tuile Achats (2/09, demande client) : le chiffre vit dans le
     CPA, l'entonnoir et le tableau. Onze tuiles + le ROAS sur une seule case
     = trois rangées de quatre, sans case orpheline. */
  "meta-ads": [
    "spend",
    "earn",
    "cpa",
    "impressions",
    "clicks",
    "frequency",
    "cpm",
    "ctr",
    "landingPageViews",
    /* La vidéo porte l'essentiel des campagnes : la vue (3 s, définition
       Meta) et la lecture complète. Le taux de complétion se lit en
       rapprochant les deux — deux grandeurs additives, comme le reste. */
    "videoViews",
    "videoCompletions",
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
  /* Même série qu'Instagram, à la demande du client — un rapport se lit
     d'un réseau à l'autre sans changer de grille. Meta ne rend plus les
     impressions par publication de Page (voir HERO_METRIC) et n'a jamais
     rendu les enregistrements : ces deux tuiles affichent « — » tant que
     rien n'est mesuré (`UNMEASURED_AT_ZERO`), jamais un zéro qui accuserait
     le client. Si Meta les rend un jour, elles se remplissent sans code. */
  facebook: ["impressions", "videoViews", "likes", "comments", "saves", "shares"],
  /* LinkedIn sert tout : impressions et portée de la page, clics,
     réactions, commentaires, partages. Pas d'enregistrement — il n'en a
     pas — et le CTR en plus, que ses clics rendent enfin calculable sur
     un onglet organique.

     Les trois dernières viennent d'ailleurs et répondent à une autre
     question : les engagements au sens de LinkedIn (clics compris), puis
     les visites de la **page** — l'accueil, et l'onglet Emplois qu'un
     client qui recrute regarde en premier. Personne n'y tombe en faisant
     défiler son fil : il a fallu venir. */
  linkedin: [
    "impressions",
    "reach",
    "clicks",
    "ctr",
    "engagements",
    "likes",
    "comments",
    "shares",
    "pageViews",
    "jobsPageViews",
  ],
  tiktok: ["likes", "comments", "saves", "shares"],
  youtube: ["likes", "comments", "shares"],
  x: ["likes", "comments", "shares"],
  "linkedin-ads": ["spend", "impressions", "clicks", "cpm", "ctr", "videoViews", "videoCompletions"],
  "tiktok-ads": ["spend", "impressions", "clicks", "cpm", "ctr", "videoViews", "videoCompletions"],
};

/**
 * Les mesures qu'un réseau ne sait pas rendre aujourd'hui : un zéro y est
 * une absence de mesure, pas une contre-performance, et s'affiche « — ».
 * Une valeur non nulle, elle, passe telle quelle — le jour où la source la
 * rend, la tuile vit.
 */
export const UNMEASURED_AT_ZERO: Partial<Record<SocialReportingNetwork, readonly MetricId[]>> = {
  facebook: ["impressions", "saves"],
};

export function isUnmeasuredZero(
  network: SocialReportingNetwork,
  metric: MetricId,
  value: number | null,
): boolean {
  return value === 0 && (UNMEASURED_AT_ZERO[network] ?? []).includes(metric);
}

/** Les découpages d'audience ont-ils un sens sur cet onglet ? */
export function hasPersona(network: SocialReportingNetwork): boolean {
  // Âge, genre et région viennent du breakdown **publicitaire**. Sur
  // l'organique, Instagram ne les donne que pour les abonnés, et Facebook pas
  // du tout : les afficher au même endroit laisserait croire à la même
  // mesure.
  return network === "meta-ads";
}



/** Le tableau de détail : par ad set en payant, par publication en organique. */
export function detailTitle(network: SocialReportingNetwork): string {
  return isPaidNetwork(network)
    ? "Performance par ad set"
    : "Performance par publication";
}
