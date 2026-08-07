import { z } from "zod";

/**
 * Validation des variables d'environnement au démarrage : mieux vaut un échec
 * explicite ici qu'un `undefined` qui remonte en production trois écrans plus
 * loin.
 *
 * Les valeurs `NEXT_PUBLIC_*` sont déréférencées littéralement, car Next les
 * remplace à la compilation et ne peut pas le faire sur un accès dynamique.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CREDENTIALS_ENCRYPTION_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(1),
});

/**
 * Secrets serveur. Volontairement paresseux : appeler cette fonction depuis un
 * composant client déclencherait une erreur immédiate plutôt que d'embarquer
 * silencieusement la clé `service_role` dans le bundle navigateur.
 */
export function serverEnv() {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() ne doit jamais être appelé côté navigateur.");
  }
  return serverSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    CREDENTIALS_ENCRYPTION_KEY: process.env.CREDENTIALS_ENCRYPTION_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
  });
}

/**
 * Noms des variables serveur absentes ou vides.
 *
 * `serverEnv()` lève une `ZodError` que l'hébergeur transforme en 500 au corps
 * vide : côté appelant — un cron, par exemple — la panne est indiscernable
 * d'un bug applicatif. Cette fonction permet de nommer ce qui manque avant
 * d'appeler quoi que ce soit d'autre.
 */
export function missingServerEnv(): string[] {
  const result = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    CREDENTIALS_ENCRYPTION_KEY: process.env.CREDENTIALS_ENCRYPTION_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
  });
  if (result.success) return [];
  return [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
}
