import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Les visuels transitent par une action serveur : la limite par défaut
      // (1 Mo) refuserait la moindre créa. 100 Mo — le plafond des fonctions
      // Vercel — parce qu'un fichier de 50 Mo plus l'enrobage multipart
      // dépassait l'ancienne limite de 50 Mo et faisait tomber la page.
      bodySizeLimit: "100mb",
    },
  },
};

export default nextConfig;
