"use server";

import { revalidatePath } from "next/cache";

import { getFinanceContext } from "@/lib/finance/access";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/**
 * Actions de l'écran Finance.
 *
 * Le journal de synchronisation s'écrit avec la clé de service : la RLS ferme
 * ces tables à l'écriture applicative, et c'est voulu — voir la migration
 * 0013. L'action vérifie le droit de décider, puis écrit comme le cron.
 */

export type FinanceActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const FINANCE_PATH = "/entreprise/finance";

/**
 * « Synchroniser maintenant ».
 *
 * Tant que les intégrations de la phase 2 ne sont pas branchées, l'action le
 * dit — elle ne consigne pas un passage fantôme au journal, et elle ne fait
 * pas semblant d'avoir synchronisé. Quand `AIRWALLEX_API_KEY` existera, elle
 * déclenchera le même pipeline que le cron, en le marquant `manual`.
 */
export async function syncNow(): Promise<FinanceActionResult> {
  const context = await getFinanceContext();
  if (!context?.canDecide) return { ok: false, error: "Action indisponible." };

  if (!process.env.AIRWALLEX_API_KEY) {
    return {
      ok: false,
      error:
        "Aucune intégration Airwallex configurée. La synchronisation arrive en phase 2 — l'écran travaille sur les données d'amorçage.",
    };
  }

  // Phase 2 : déclencher ici le pipeline partagé avec le cron. En attendant,
  // consigner l'intention garde le journal honnête si des clés sont présentes
  // sans que le pipeline existe encore.
  await createAdminClient().from("finance_sync_runs").insert({
    org_id: context.orgId,
    kind: "transactions",
    status: "error",
    triggered_via: "manual",
    finished_at: new Date().toISOString(),
    error: "Pipeline de synchronisation non déployé (phase 2).",
  });

  revalidatePath(FINANCE_PATH);
  return { ok: false, error: "Le pipeline de synchronisation arrive en phase 2." };
}

/** Recatégorise une dépense — le geste d'entretien du tableau. */
export async function recategorizeTransaction(input: {
  transactionId: string;
  categoryId: string | null;
}): Promise<FinanceActionResult> {
  const context = await getFinanceContext();
  if (!context?.canDecide) return { ok: false, error: "Action indisponible." };

  // Client de session, pas de service : la RLS autorise précisément ce geste
  // aux owners — l'action n'a aucune raison de la contourner.
  const supabase = await createClient();
  const { error } = await supabase
    .from("finance_transactions")
    .update({ category_id: input.categoryId })
    .eq("id", input.transactionId)
    .eq("org_id", context.orgId);

  if (error) return { ok: false, error: `Recatégorisation refusée : ${error.message}` };

  revalidatePath(FINANCE_PATH);
  return { ok: true, message: "Catégorie mise à jour." };
}
