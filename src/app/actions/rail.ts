"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getViewer } from "@/lib/auth";
import { mergeRailOrder, parseRailOrder } from "@/lib/navigation-order";
import { createClient } from "@/lib/supabase/server";

/**
 * L'ordre du rail, rangé à la souris et retenu par personne.
 *
 * Une préférence d'affichage comme le rail replié — mais celle-ci vit en base
 * (`profiles.rail_order`) et non dans un cookie : elle doit survivre au
 * navigateur. Le groupe déposé remplace sa liste, l'autre groupe garde la
 * sienne ; le serveur relit la ligne avant d'écrire, sinon ranger les
 * clients effacerait « Mon entreprise » rangé la veille depuis un autre
 * onglet.
 *
 * L'identifiant du compte vient de la session, jamais du formulaire ; le
 * `.eq` explicite tient le rôle de `profiles_update_own` en accès ouvert,
 * où le client bascule en `service_role` et où la politique ne s'applique
 * plus.
 */

export type RailResult = { ok: true; message: string } | { ok: false; error: string };

const schema = z.object({
  group: z.enum(["clients", "entreprise"]),
  hrefs: z.array(z.string().min(1).max(200)).max(100),
});

export async function saveRailOrder(input: {
  group: "clients" | "entreprise";
  hrefs: string[];
}): Promise<RailResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ordre invalide." };
  }

  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Session requise." };

  const supabase = await createClient();
  const { data: profile, error: readError } = await supabase
    .from("profiles")
    .select("rail_order")
    .eq("id", viewer.user.id)
    .maybeSingle();
  if (readError) {
    console.error("rail_order : lecture refusée", readError.message);
    return { ok: false, error: "L'ordre n'a pas pu être relu." };
  }

  const merged = mergeRailOrder(
    parseRailOrder((profile as { rail_order?: unknown } | null)?.rail_order),
    parsed.data.group,
    parsed.data.hrefs,
  );

  const { error } = await supabase
    .from("profiles")
    .update({ rail_order: merged } as never)
    .eq("id", viewer.user.id);
  if (error) {
    console.error("rail_order : écriture refusée", error.message);
    return { ok: false, error: "L'ordre n'a pas pu être enregistré." };
  }

  // Le rail est rendu par tous les layouts : c'est l'arbre entier qui relit
  // l'ordre, pas une page.
  revalidatePath("/", "layout");
  return { ok: true, message: "Ordre enregistré." };
}
