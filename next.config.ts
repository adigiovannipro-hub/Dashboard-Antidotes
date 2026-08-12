import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
