import "server-only";

import { createAdminClient } from "@/lib/supabase/server";

/**
 * Raccroche à un compte les inscriptions Academy laissées à son adresse.
 *
 * `app.handle_new_user()` fait ce travail **à la création du compte**, et
 * seulement là. Or le compte existe souvent déjà quand l'inscription arrive :
 * une élève inscrite à une seconde formation, une adresse qu'on a réinvitée
 * après un premier envoi raté, un compte créé avant que la table existe. Dans
 * tous ces cas la ligne restait « invitée » avec `user_id` nul, la lecture ne
 * trouvait aucune inscription, et l'élève pourtant connectée tombait sur un
 * 404 — vécu avec la première élève réelle.
 *
 * On rejoue donc la même règle au moment qui a du sens : la connexion. Le
 * client est `service_role` parce que la ligne à raccrocher ne porte pas
 * encore l'identifiant de la personne — la RLS ne la lui rendrait jamais.
 * Le filtre par adresse est la seule frontière, et c'est la bonne : Supabase
 * a vérifié cette adresse avant de rendre la session.
 *
 * `revoked` est exclu, comme dans le trigger : un accès retiré ne se rouvre
 * pas parce que la personne se reconnecte.
 */
export async function claimEnrollments(options: {
  userId: string;
  email: string;
}): Promise<number> {
  const email = options.email.trim().toLowerCase();
  if (!email) return 0;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("academy_enrollments")
      .update({
        user_id: options.userId,
        status: "active",
        activated_at: new Date().toISOString(),
      })
      // L'action d'inscription minuscule l'adresse avant l'écriture, et
      // l'index unique est sur `lower(email)` : l'égalité stricte retrouve la
      // ligne. `ilike` aurait pris `_` pour un joker.
      .eq("email", email)
      .eq("status", "invited")
      .select("id");
    if (error) {
      console.error(`[academy] raccrochage refusé : ${error.message}`);
      return 0;
    }
    return (data ?? []).length;
  } catch (error) {
    // Jamais bloquant : une clé absente ne doit pas empêcher une connexion.
    console.error(`[academy] raccrochage impossible : ${(error as Error).message}`);
    return 0;
  }
}
