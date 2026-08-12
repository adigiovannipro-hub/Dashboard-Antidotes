import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Les prompts de génération sont des fichiers markdown lus au runtime
  // (`src/lib/production/prompts.ts`) : sans cette déclaration, le tracing de
  // Vercel ne les embarquerait pas et les routes échoueraient en production.
  outputFileTracingIncludes: {
    "/api/generate/[phase]": ["./src/lib/prompts/**"],
    "/api/jobs/[id]/run": ["./src/lib/prompts/**"],
  },
  experimental: {
    // Le proxy (src/proxy.ts) tamponne le corps des requêtes qu'il
    // intercepte et **tronque à 10 Mo par défaut** : l'action recevait un
    // formulaire coupé (« Unexpected end of form », 500) dès qu'une vidéo
    // dépassait 10 Mo. Les visuels partent désormais du navigateur droit
    // vers Supabase Storage, mais le plafond reste levé pour tout envoi qui
    // passerait encore par ici.
    proxyClientMaxBodySize: "100mb",
    serverActions: {
      // Aligné sur le plafond des fonctions Vercel. La limite par défaut
      // (1 Mo) refuserait la moindre créa passée par une action.
      bodySizeLimit: "100mb",
    },
  },
};

export default nextConfig;
