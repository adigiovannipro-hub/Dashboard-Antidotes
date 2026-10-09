import { Funnel_Display, Geist, Geist_Mono, Instrument_Serif } from "next/font/google";

/**
 * Les quatre familles de la charte (9/10/2026), et pas une de plus :
 * Funnel Display pour les grands titres (H1 600, H2 500), Geist pour le
 * texte, les H3 et l'interface, Geist Mono pour les surtitres et les
 * données, Instrument Serif en italique pour la touche manuscrite de deux
 * ou trois mots. Téléchargées à la compilation et servies depuis le site :
 * aucune requête vers Google au chargement.
 */
export const display = Funnel_Display({ subsets: ["latin"], weight: "variable", variable: "--font-display-face", display: "swap" });
export const text = Geist({ subsets: ["latin"], weight: "variable", variable: "--font-text-face", display: "swap" });
export const mono = Geist_Mono({ subsets: ["latin"], weight: ["400"], variable: "--font-mono-face", display: "swap" });
export const serif = Instrument_Serif({ subsets: ["latin"], weight: ["400"], style: ["italic"], variable: "--font-serif-face", display: "swap" });

export const fontClassName = `${display.variable} ${text.variable} ${mono.variable} ${serif.variable}`;
