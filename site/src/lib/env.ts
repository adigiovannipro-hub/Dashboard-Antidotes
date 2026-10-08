import "server-only";

import { z } from "zod";

/**
 * Les variables d'environnement du serveur, validées à la première lecture.
 *
 * Celles qui conditionnent une fonctionnalité (Composio pour les courriels
 * et l'agenda) sont optionnelles : sans elles, le site enregistre tout en
 * base et met les envois en file d'attente, il ne tombe pas.
 */
const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(10),
  SITE_DB_KEY: z.string().min(16),
  CRON_SECRET: z.string().min(16),
  ADMIN_SECRET: z.string().min(16),
  OWNER_EMAIL: z.string().email(),
  OWNER_NAME: z.string().default("Alessandro Di Giovanni"),
  OWNER_TIMEZONE: z.string().default("Asia/Makassar"),
  BOOKING_CALENDAR_ID: z.string().default("primary"),
  COMPOSIO_API_KEY: z.string().optional(),
  COMPOSIO_BASE_URL: z.string().url().optional(),
  COMPOSIO_USER_ID: z.string().default("agence"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("https://antidotes.agency"),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | null = null;

export function env(): ServerEnv {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
      throw new Error(`Variables d'environnement invalides ou absentes : ${missing}`);
    }
    cached = parsed.data;
  }
  return cached;
}

/** Composio est-il configuré ? Sans clé, les envois attendent en file. */
export function composioEnabled(): boolean {
  return Boolean(env().COMPOSIO_API_KEY);
}
