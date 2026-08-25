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

/**
 * Secrets serveur, validés **un par un** et non plus d'un seul bloc.
 *
 * Le bloc entier était exigé par chaque appelant, ce qui liait des chemins
 * sans rapport : la synchronisation Airwallex échouait faute de
 * `CREDENTIALS_ENCRYPTION_KEY`, qui ne chiffre que les jetons Gmail du module
 * Reçus et qu'elle n'utilise jamais. Une route ne doit dépendre que de ce
 * qu'elle lit.
 */
const serverSchema = {
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CREDENTIALS_ENCRYPTION_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(1),
  /* Déclenche le workflow GitHub qui synchronise Airwallex — l'hébergeur ne
     peut pas le faire lui-même, Airwallex refusant ses adresses IP. Jeton à
     portée fine, droit « Actions : read and write » sur ce seul dépôt. */
  GITHUB_SYNC_TOKEN: z.string().min(1),
  /* Clé du projet Composio Platform (`ak_…`) — la passerelle qui porte les
     jetons Google Analytics. Serveur uniquement : elle ouvre l'accès à tous
     les comptes connectés du projet. Voir `docs/web-analytics-setup.md`. */
  COMPOSIO_API_KEY: z.string().min(1),
} as const;

export type ServerEnvKey = keyof typeof serverSchema;

const ALL_SERVER_KEYS = Object.keys(serverSchema) as ServerEnvKey[];

/**
 * Secrets demandés, validés à l'appel.
 *
 * Volontairement paresseux : appeler cette fonction depuis un composant client
 * déclencherait une erreur immédiate plutôt que d'embarquer silencieusement la
 * clé `service_role` dans le bundle navigateur.
 */
export function serverEnv<K extends ServerEnvKey>(
  ...keys: K[]
): Record<K, string> {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() ne doit jamais être appelé côté navigateur.");
  }

  const missing = missingServerEnv(...keys);
  if (missing.length > 0) {
    throw new Error(
      `Variables d'environnement absentes : ${missing.join(", ")}.`,
    );
  }

  return Object.fromEntries(
    keys.map((key) => [key, process.env[key] as string]),
  ) as Record<K, string>;
}

/**
 * Noms des variables absentes ou vides, parmi celles demandées — toutes si
 * aucune n'est nommée.
 *
 * `serverEnv()` lève, et l'hébergeur transforme la levée en 500 au corps vide :
 * côté appelant — un cron, par exemple — la panne est alors indiscernable d'un
 * bug applicatif. Cette fonction permet de nommer ce qui manque **avant**
 * d'appeler quoi que ce soit d'autre.
 */
export function missingServerEnv(...keys: ServerEnvKey[]): ServerEnvKey[] {
  const checked = keys.length > 0 ? keys : ALL_SERVER_KEYS;
  return checked.filter(
    (key) => !serverSchema[key].safeParse(process.env[key]).success,
  );
}
