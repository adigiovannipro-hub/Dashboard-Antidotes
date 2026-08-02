import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Les visuels transitent par une action serveur : la limite par défaut
      // (1 Mo) refuserait la moindre créa. Alignée sur le plafond du bucket.
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
