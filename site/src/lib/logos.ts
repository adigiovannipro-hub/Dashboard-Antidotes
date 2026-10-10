import type { MarqueeLogo } from "@/components/site/logo-marquee";

/**
 * Les marques du bandeau : les clients qui ont confié leurs réseaux, dans
 * l'ordre des priorités du brief, plus les agences avec qui le travail se
 * fait en coulisses. Chacune par son logo officiel, en version horizontale,
 * rapatrié du site de la marque par `scripts/visuels-cas.mjs` (la liste et
 * les sources sont dans `scripts/visuels.json`). Le fichier ne donne que la
 * forme : le bandeau le peint en Craie.
 *
 * `width` × `height` : les dimensions du fichier (recadré sur son dessin).
 * `size` : la hauteur d'affichage en px, au jugé de l'œil — un emblème coiffé
 * de trois lignes (la meunerie) monte plus haut qu'un mot seul en capitales
 * grasses (KARE), une ligne fine et très espacée (Catherine Osti, seule
 * marque sans version horizontale publiée : la ligne de son nom est isolée
 * du logo officiel) plus bas encore. McDonald's, L'Originel et MIF viennent
 * des fichiers fournis par Alessandro le 11/10, passés en pochoir (opacité
 * tirée de l'encre, fond retiré). Bexley vient du SVG officiel de
 * bexley.com, réduit à ses lettres (le cartouche vert et le filet doré
 * retirés, le cadre posé sur le tracé) : hors de la liste de rapatriement,
 * qui l'écraserait.
 */
export const CLIENT_LOGOS: MarqueeLogo[] = [
  { src: "/logos/i-way.png", name: "I-WAY", width: 278, height: 227, size: 52 },
  { src: "/logos/bondet.svg", name: "Lunettes Bondet", width: 170, height: 35.4, size: 28 },
  { src: "/logos/mcdonalds.png", name: "McDonald's", width: 258, height: 33, size: 22 },
  { src: "/logos/loriginel.png", name: "L'Originel, brûlerie à Versailles", width: 851, height: 240, size: 36 },
  { src: "/logos/mif.png", name: "MIF", width: 80, height: 52, size: 26 },
  { src: "/logos/bexley.svg", name: "Bexley", width: 121.75, height: 47.21, size: 30 },
  { src: "/logos/catherine-osti.png", name: "Catherine Osti", width: 382, height: 27, size: 14 },
  { src: "/logos/chasseurs-de-graines.svg", name: "Chasseurs de Graines", width: 199.8, height: 73, size: 40 },
  { src: "/logos/anmf.svg", name: "ANMF, Association nationale de la meunerie française", width: 173.32, height: 87.61, size: 44 },
  { src: "/logos/banque-populaire.svg", name: "Banque Populaire", width: 593.3, height: 119.8, size: 30 },
  { src: "/logos/kare.svg", name: "Kare Design", width: 160, height: 28, size: 18 },
  { src: "/logos/mediapilote.svg", name: "Mediapilote", width: 298, height: 46.96, size: 24 },
];
