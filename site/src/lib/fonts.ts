import { Hanken_Grotesk, Rubik } from "next/font/google";

/**
 * Deux familles, pas une de plus. Hanken Grotesk pour tout ce qui se lit :
 * titres et corps, deux graisses (400, 500), interlettrage serré sur les
 * titres. Rubik en graisse 900 pour le seul logotype, dont les lettres se
 * touchent. Téléchargées à la compilation, servies depuis le site : aucune
 * requête vers Google au chargement. Vérifiées sur pièce le 8/10/2026
 * (fichiers TTF relus, rendus sur fond sombre).
 */
export const text = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-text", display: "swap" });
export const brand = Rubik({ subsets: ["latin"], weight: ["900"], variable: "--font-brand-face", display: "swap", preload: false });

export const fontClassName = `${text.variable} ${brand.variable}`;
