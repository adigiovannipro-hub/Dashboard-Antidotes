import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";

/**
 * Deux voix : Geist pour tout ce qui se lit — nette, neutre, premium —, et
 * Instrument Serif en italique pour un seul mot par titre. Téléchargées à la
 * compilation, servies depuis le site : aucune requête vers Google au
 * chargement.
 */
export const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
export const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
export const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["italic", "normal"],
  variable: "--font-instrument",
  display: "swap",
});

export const fontClassName = `${geist.variable} ${geistMono.variable} ${instrument.variable}`;
