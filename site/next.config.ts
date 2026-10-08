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
