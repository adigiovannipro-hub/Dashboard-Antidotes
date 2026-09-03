import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { isOpenAccess } from "@/lib/access-mode";
import { publicEnv, serverEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Client de lecture en accès ouvert.
 *
 * Volontairement distinct de `createAdminClient()` : celui-ci ne dépend que de
 * la clé `service_role`, là où l'autre exige aussi les secrets de chiffrement
 * et de cron. Sans cette séparation, une variable d'environnement manquante
 * ferait planter l'affichage entier au lieu d'une fonctionnalité.
 */
function createOpenAccessClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY est requise en accès ouvert : sans session, " +
        "la RLS ne rendrait aucune ligne.",
    );
  }
  return createSupabaseClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Client **toujours** adossé aux cookies, quel que soit le mode d'accès.
 *
 * C'est celui de l'identité : lire la session, la poser, la retirer. Il ne
 * bascule jamais en `service_role`, et c'est tout l'intérêt — l'accès ouvert
 * rendait un client sans gestion de cookies, si bien que `verifyOtp` réussissait
 * côté Supabase et n'écrivait la session **nulle part**. Résultat : personne ne
 * pouvait se connecter tant que l'application était ouverte, et tout visiteur
 * — élève comprise — retombait sur l'identité empruntée de l'owner.
 */
export async function createSessionClient() {
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
 * Client serveur portant la session de l'utilisateur. Toutes les requêtes
 * passent par la RLS : c'est le client à utiliser par défaut.
 *
 * **En accès ouvert, il n'y a pas de session**, et la RLS ne rendrait donc
 * aucune ligne. Les lectures basculent alors en `service_role`, ce qui lève
 * l'isolation entre espaces. C'est le prix de l'ouverture, il est assumé et
 * documenté dans `lib/access-mode.ts`.
 */
export async function createClient() {
  if (isOpenAccess()) {
    // Lire les cookies sans s'en servir, uniquement pour empêcher le rendu
    // statique. Sans cette ligne, Next ne voit plus aucune dépendance à la
    // requête et fige le hub, la Modération et l'administration au moment du
    // build — un dashboard gelé sur les données de la veille.
    await cookies();
    return createOpenAccessClient();
  }

  return createSessionClient();
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
    serverEnv("SUPABASE_SERVICE_ROLE_KEY").SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
