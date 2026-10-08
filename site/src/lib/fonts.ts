import { Fredoka, Host_Grotesk } from "next/font/google";

/**
 * Deux familles, pas une de plus. Host Grotesk, variable, pour tout ce qui
 * se lit : titres en 500, corps en 400, chiffres tabulaires par défaut.
 * Fredoka en 700 pour le seul logotype, dont les lettres se touchent à
 * −0,07 em (écarts mesurés paire par paire par le scout typographique du
 * 8/10/2026). Téléchargées à la compilation, servies depuis le site :
 * aucune requête vers Google au chargement.
 */
export const text = Host_Grotesk({ subsets: ["latin"], weight: "variable", variable: "--font-text", display: "swap" });
export const brand = Fredoka({ subsets: ["latin"], weight: ["700"], variable: "--font-brand-face", display: "swap", preload: false });

export const fontClassName = `${text.variable} ${brand.variable}`;
