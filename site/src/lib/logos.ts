import type { MarqueeLogo } from "@/components/site/logo-marquee";

/**
 * Les marques du bandeau : les clients qui ont confié leurs réseaux, dans
 * l'ordre des priorités du brief, plus les agences avec qui le travail se
 * fait en coulisses. Fichiers dans `public/logos`, rapatriés une fois par
 * `scripts/visuels-cas.mjs`. Bondet, ANMF et Banque Populaire sont des aplats
 * de couleur : nom seul, jusqu'au wordmark monochrome à leur demander.
 */
export const CLIENT_LOGOS: MarqueeLogo[] = [
  { src: "/logos/i-way.png", name: "I-WAY", width: 164, height: 160, tone: "invert" },
  { src: "/logos/bondet.png", name: "Lunettes Bondet", width: 160, height: 160, tone: "lift" },
  { src: "/logos/catherine-osti.png", name: "Catherine Osti", width: 221, height: 160, tone: "mono" },
  { src: "/logos/chasseurs-de-graines.svg", name: "Chasseurs de Graines", width: 274, height: 97, tone: "mono" },
  { src: "/logos/anmf.png", name: "ANMF", width: 160, height: 160, tone: "lift" },
  { src: "/logos/banque-populaire.png", name: "Banque Populaire", width: 160, height: 160, tone: "lift" },
  { src: "/logos/kare.svg", name: "Kare Design", width: 160, height: 28, tone: "mono" },
  { src: "/logos/mediapilote.svg", name: "Mediapilote", width: 298, height: 47, tone: "mono" },
];
