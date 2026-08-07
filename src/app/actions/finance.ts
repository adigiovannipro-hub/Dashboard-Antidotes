"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getFinanceContext } from "@/lib/finance/access";
import { createClient } from "@/lib/supabase/server";

/**
 * Actions de l'écran Finance.
 *
 * Même contrat que les autres modules : signature `useActionState`
 * (état précédent, FormData), entrées validées par `safeParse` avant de
 * toucher quoi que ce soit. Une action reçoit ce que le réseau lui apporte,
 * pas ce que le composant croit lui avoir envoyé.
 */

export type FinanceActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const FINANCE_PATH = "/entreprise/finance";

/* Il n'y a plus d'action « Synchroniser maintenant », et son retrait est un
   correctif : Airwallex refuse les adresses IP de Vercel. Partant de
   l'hébergeur, cette action se faisait renvoyer un « 403 Forbidden » à tous
   les coups, et son seul effet observable était d'inscrire trois échecs au
   journal. La synchronisation part d'une machine GitHub — voir
   `.github/workflows/airwallex-sync.yml` — toutes les heures. Le pipeline
   lui-même, `runFinanceSync`, n'a pas bougé d'une ligne. */

const recategorizeAction = z.object({
  transactionId: z.uuid(),
  // Champ vide : retirer la catégorie. La distinction vide / absent importe —
  // un formulaire qui n'envoie pas le champ est incomplet, pas un retrait.
  categoryId: z
    .uuid()
    .or(z.literal(""))
    .transform((value) => (value === "" ? null : value)),
});

/** Recatégorise une dépense — le geste d'entretien du tableau. */
export async function recategorizeTransaction(
  _previous: FinanceActionResult | null,
  formData: FormData,
): Promise<FinanceActionResult> {
  const parsed = recategorizeAction.safeParse({
    transactionId: formData.get("transactionId"),
    categoryId: formData.get("categoryId"),
  });
  if (!parsed.success) return { ok: false, error: "Requête incomplète." };

  const context = await getFinanceContext();
  if (!context?.canDecide) return { ok: false, error: "Action indisponible." };

  // Client de session, pas de service : la RLS autorise précisément ce geste
  // aux owners — l'action n'a aucune raison de la contourner.
  const supabase = await createClient();
  const { error } = await supabase
    .from("finance_transactions")
    .update({ category_id: parsed.data.categoryId })
    .eq("id", parsed.data.transactionId)
    .eq("org_id", context.orgId);

  if (error) return { ok: false, error: `Recatégorisation refusée : ${error.message}` };

  revalidatePath(FINANCE_PATH);
  return { ok: true, message: "Catégorie mise à jour." };
}
