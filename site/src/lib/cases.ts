/**
 * Les visuels des cas clients : de vraies publications rapatriées des
 * plannings (`site/public/cas`, produites par `scripts/visuels-cas.mjs`).
 * Affiche en webp, clip de six secondes en mp4 muet quand la publication est
 * une vidéo. Le compte est celui qui a publié : c'est l'étiquette du mockup.
 */
export type CaseVisual = { poster: string; video?: string; handle: string; alt: string };

export const CASE_VISUALS: Record<string, CaseVisual[]> = {
  anmf: [
    { poster: "/cas/anmf-meunier.webp", video: "/cas/anmf-meunier.mp4", handle: "@chasseursdegraines", alt: "Reel : une journée de meunier, filmée au moulin" },
    { poster: "/cas/anmf-spot.webp", video: "/cas/anmf-spot.mp4", handle: "@chasseursdegraines", alt: "Reel : la main dans le grain" },
    { poster: "/cas/anmf-expert.webp", video: "/cas/anmf-expert.mp4", handle: "@chasseursdegraines", alt: "Reel : un expert de la meunerie" },
    { poster: "/cas/anmf-carrousel.webp", handle: "@chasseursdegraines", alt: "Carrousel : une semaine dans la vie de Jules, commercial" },
    { poster: "/cas/anmf-post.webp", handle: "@chasseursdegraines", alt: "Publication : on a tous un boulanger préféré" },
  ],
  bondet: [
    { poster: "/cas/bondet-solaire.webp", video: "/cas/bondet-solaire.mp4", handle: "@lunettesbondet", alt: "Reel : une paire de solaires Bondet sur une table" },
    { poster: "/cas/bondet-lumiere.webp", video: "/cas/bondet-lumiere.mp4", handle: "@lunettesbondet", alt: "Reel : la lumière sur une monture" },
    { poster: "/cas/bondet-joy.webp", handle: "@lunettesbondet", alt: "Publication : Bondet au soleil, dans l'herbe" },
    { poster: "/cas/bondet-silmo.webp", handle: "@lunettesbondet", alt: "Publication : l'équipe Bondet au SILMO" },
    { poster: "/cas/bondet-jackie.webp", handle: "@lunettesbondet", alt: "Publication : la monture Jackie, huit coloris" },
    { poster: "/cas/bondet-moments.webp", handle: "@lunettesbondet", alt: "Publication : une monture posée sur un livre" },
  ],
};
