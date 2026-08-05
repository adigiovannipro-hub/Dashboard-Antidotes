"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getViewer } from "@/lib/auth";
import { getFinanceContext } from "@/lib/finance/access";
import { runFinanceSync } from "@/lib/finance/sync";
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

/**
 * « Synchroniser maintenant » — le même pipeline que le cron, marqué `manual`
 * au journal avec son demandeur.
 *
 * Sans paramètre, et néanmoins branchée sur `useActionState` : une fonction
 * qui ignore l'état précédent et le FormData n'a pas à faire semblant de les
 * recevoir — TypeScript accepte une signature plus courte que l'attendue.
 */
export async function syncNow(): Promise<FinanceActionResult> {
  const context = await getFinanceContext();
  if (!context?.canDecide) return { ok: false, error: "Action indisponible." };

  if (!process.env.AIRWALLEX_API_KEY || !process.env.AIRWALLEX_CLIENT_ID) {
    return {
      ok: false,
      error:
        "Aucune intégration Airwallex configurée : clés absentes de l'environnement. L'écran travaille sur les données d'amorçage.",
    };
  }

  const viewer = await getViewer();
  const report = await runFinanceSync({
    orgId: context.orgId,
    triggeredVia: "manual",
    requestedBy: viewer?.user.id ?? null,
  });

  revalidatePath(FINANCE_PATH);

  const errors = report.filter((step) => step.status === "error");
  if (errors.length > 0) {
    return {
      ok: false,
      error: `Synchronisation partielle — ${errors
        .map((step) => `${step.kind} : ${step.error}`)
        .join(" ; ")}`,
    };
  }

  const rows = Object.fromEntries(report.map((step) => [step.kind, step.rows]));
  return {
    ok: true,
    message: `Synchronisation terminée : ${rows.balances ?? 0} soldes, ${rows.transactions ?? 0} dépenses, ${rows.invoices ?? 0} factures.`,
  };
}

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
