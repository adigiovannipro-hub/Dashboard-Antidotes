import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";

/**
 * Deux voix : Geist pour tout ce qui se lit — nette, neutre, premium —, et
 * Instrument Serif en italique pour un seul mot par titre. Téléchargées à la
 * compilation, servies depuis le site : aucune requête vers Google au
 * chargement.
 */
export const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
// Le mono ne sert qu'aux petits numéros des services, sous la ligne de flottaison :
// pas de préchargement, il ne doit pas disputer la bande passante au titre.
export const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap", preload: false });
export const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  // Italique seulement : `accent-serif` ne pose jamais le romain, et le fichier pesait 15 Ko de plus au chargement.
  style: ["italic"],
  variable: "--font-instrument",
  display: "swap",
});

export const fontClassName = `${geist.variable} ${geistMono.variable} ${instrument.variable}`;
