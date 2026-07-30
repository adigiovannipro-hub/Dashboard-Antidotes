"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      // Évite les transitions de couleur au basculement, qui donnent une
      // impression de lenteur sur les pages denses en graphiques.
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
