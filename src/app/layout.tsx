import type { Metadata } from "next";
import { Montserrat } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

/**
 * Charte Antidotes : Montserrat pour les titres, Arial pour le corps.
 *
 * Arial n'est pas chargée — c'est une police système, présente partout, et
 * l'appeler par sa pile évite une requête réseau. Montserrat est la seule
 * fonte téléchargée, et seulement pour les titres.
 */
const montserrat = Montserrat({
  variable: "--font-heading-family",
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
      className={`${montserrat.variable} h-full antialiased`}
      style={
        {
          "--font-body": 'Arial, Helvetica, "Liberation Sans", sans-serif',
        } as React.CSSProperties
      }
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
