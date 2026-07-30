import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import dotenv from "dotenv";
import { defineConfig } from "vitest/config";

// Les tests d'isolation interrogent un vrai projet Supabase : ils ont besoin
// des clés de `.env.local`, que Vite n'injecte pas dans `process.env`.
dotenv.config({ path: ".env.local", quiet: true });

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Les specs Playwright vivent dans e2e/ et ne doivent pas être ramassées ici.
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    // Les tests d'isolation créent puis suppriment des comptes sur un projet
    // Supabase distant : ils doivent s'exécuter en série.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  },
});
