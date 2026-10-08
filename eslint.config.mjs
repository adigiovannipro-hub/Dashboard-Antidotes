import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Les skills sont du code tiers, déposé tel quel (nextlevelbuilder,
    // microsoft, supabase, vercel-labs). Leurs scripts `.cjs` échouent sur
    // `no-require-imports` alors qu'ils ne sont ni compilés, ni livrés, ni
    // à nous : les linter mettait la CI au rouge sans rien améliorer.
    ".agents/**",
    ".claude/**",
    // Le site vitrine (site/) est un projet Next.js autonome, avec son propre
    // lockfile, son tsconfig et son eslint : le linter du dashboard n'a pas
    // à le relire, et ses alias `@/` ne désignent pas les nôtres.
    "site/**",
  ]),
]);

export default eslintConfig;
