import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { publicEnv, serverEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Client serveur portant la session de l'utilisateur. Toutes les requêtes
 * passent par la RLS : c'est le client à utiliser par défaut.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Appelé depuis un Server Component : les cookies sont en lecture
            // seule. Le proxy s'est déjà chargé de rafraîchir la session.
          }
        },
      },
    },
  );
}

/**
 * Client `service_role` : il **contourne la RLS**.
 *
 * Réservé à trois usages, jamais à répondre à une requête utilisateur :
 *   • l'écriture des données par les jobs de synchronisation ;
 *   • le rendu des pages de partage public, après validation du token ;
 *   • l'administration (invitations, création d'espaces).
 *
 * Toute autre utilisation revient à désactiver l'isolation entre clients.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv().SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
