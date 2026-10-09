import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

/**
 * Le site vit dans un sous-dossier du dépôt du dashboard, avec son propre
 * lockfile : sans racine explicite, Next remonte au dépôt parent, y trouve
 * son `postcss.config.mjs` et son `src/proxy.ts`, et le build casse.
 */
const ROOT = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: ROOT,
  /*
   * Le cache disque de Turbopack (actif par défaut en compilation depuis
   * Next 16.4) a resservi le 9/10/2026 l'ancienne feuille de style après une
   * refonte de globals.css — la règle `*.css` passe par le chargeur de
   * Tailwind, dont les dépendances lui échappent. Vercel restaure ce cache
   * d'un déploiement à l'autre : on compile donc toujours à neuf.
   */
  experimental: { turbopackFileSystemCacheForBuild: false },
  turbopack: {
    root: ROOT,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
