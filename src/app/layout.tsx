import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

/**
 * Montserrat pour les titres, Inter pour l'interface.
 *
 * Arial tenait le corps de texte jusqu'ici. Elle sort de l'écran — ses formes
 * se ferment sous 14 px et ses chiffres n'ont pas de chasse tabulaire, deux
 * défauts rédhibitoires pour un tableau de bord. Elle reste la police des
 * exports PPT et PDF, où la compatibilité prime sur le rendu.
 *
 * Les deux fontes sont découpées au sous-ensemble latin et chargées en
 * `swap` : le texte s'affiche immédiatement dans la pile système, puis
 * bascule. Coût réseau borné, aucun écran blanc.
 */
const montserrat = Montserrat({
  variable: "--font-heading-family",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-body-family",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Antidotes",
    template: "%s · Antidotes",
  },
  description:
    "Plateforme de dashboards d'Antidotes : performance des campagnes et des réseaux sociaux, espace par espace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      // `suppressHydrationWarning` est requis par next-themes, qui applique la
      // classe de thème avant l'hydratation pour éviter le flash de couleur.
      suppressHydrationWarning
      className={`${montserrat.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <ThemeProvider>
          {children}
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
