"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireFinanceAccess } from "@/lib/finance/access";
import { installmentsFor } from "@/lib/billing/schedule";
import { createClient } from "@/lib/supabase/server";

/**
 * Actions du module Échéances de facturation.
 *
 * Même contrat que les autres modules : signature `useActionState`
 * (état précédent, FormData), `safeParse` en entrée avant de toucher quoi que
 * ce soit, client de session — la RLS reste l'autorité, ces actions n'ont
 * aucune raison de la contourner.
 *
 * La garde est celle du module Finance : ces échéances sont l'autre moitié de
 * la même comptabilité, un droit distinct ne protégerait rien de plus.
 */

export type BillingActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const BILLING_PATH = "/entreprise/echeances";
const FINANCE_PATH = "/entreprise/finance";

function refresh() {
  revalidatePath(BILLING_PATH);
  // Le bloc « Facturation à venir » du dashboard Finance lit les mêmes lignes.
  revalidatePath(FINANCE_PATH);
}

// --- Créer un engagement -----------------------------------------------------

const createEngagementInput = z.object({
  clientName: z.string().trim().min(1).max(200),
  label: z.string().trim().min(1).max(200),
  /* Le formulaire parle en euros, la base en centimes. La virgule française
     est admise : « 2500,50 » vaut 2 500,50 €. */
  monthlyAmount: z
    .string()
    .trim()
    .transform((value) => Number(value.replace(/\s/g, "").replace(",", ".")))
    .pipe(z.number().positive().finite()),
  /* `<input type="month">` envoie `AAAA-MM` : on cale au 1er. */
  firstMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .transform((value) => `${value}-01`),
  monthsCount: z.coerce.number().int().min(1).max(60),
  notes: z.string().trim().max(2000).optional(),
});

export async function createEngagement(
  _previous: BillingActionResult | null,
  formData: FormData,
): Promise<BillingActionResult> {
  const parsed = createEngagementInput.safeParse({
    clientName: formData.get("clientName"),
    label: formData.get("label"),
    monthlyAmount: formData.get("monthlyAmount"),
    firstMonth: formData.get("firstMonth"),
    monthsCount: formData.get("monthsCount"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "Formulaire incomplet ou montant invalide." };
  }

  const context = await requireFinanceAccess();
  if (!context.canDecide) return { ok: false, error: "Action indisponible." };

  const monthlyAmountCents = Math.round(parsed.data.monthlyAmount * 100);
  const supabase = await createClient();

  try {
    const { data: engagement, error } = await supabase
      .from("billing_engagements")
      .insert({
        org_id: context.orgId,
        client_name: parsed.data.clientName,
        label: parsed.data.label,
        monthly_amount_cents: monthlyAmountCents,
        currency: "EUR",
        first_month: parsed.data.firstMonth,
        months_count: parsed.data.monthsCount,
        notes: parsed.data.notes ?? null,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const engagementId = (engagement as { id: string }).id;
    const lines = installmentsFor({
      first_month: parsed.data.firstMonth,
      months_count: parsed.data.monthsCount,
      monthly_amount_cents: monthlyAmountCents,
      currency: "EUR",
    });

    const { error: linesError } = await supabase.from("billing_installments").insert(
      lines.map((line) => ({
        org_id: context.orgId,
        engagement_id: engagementId,
        ...line,
      })) as never,
    );
    if (linesError) {
      // Un engagement sans ses échéances serait un fantôme : on le retire
      // plutôt que de laisser une coquille que rien n'affichera correctement.
      await supabase.from("billing_engagements").delete().eq("id", engagementId);
      throw new Error(linesError.message);
    }

    refresh();
    return {
      ok: true,
      message: `Engagement créé : ${lines.length} échéance${lines.length > 1 ? "s" : ""} générée${lines.length > 1 ? "s" : ""}.`,
    };
  } catch (error) {
    return {
      ok: false,
      error: `Création refusée : ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// --- Faire avancer une échéance ----------------------------------------------

const setStatusInput = z.object({
  installmentId: z.uuid(),
  status: z.enum(["pending", "issued", "paid", "skipped"]),
});

export async function setInstallmentStatus(
  _previous: BillingActionResult | null,
  formData: FormData,
): Promise<BillingActionResult> {
  const parsed = setStatusInput.safeParse({
    installmentId: formData.get("installmentId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { ok: false, error: "Requête incomplète." };

  const context = await requireFinanceAccess();
  if (!context.canDecide) return { ok: false, error: "Action indisponible." };

  /* Les horodatages suivent le statut : marquer « émise » pose `issued_at`,
     revenir à « à émettre » les efface. Un statut sans sa date raconterait une
     histoire à moitié. */
  const stamps = {
    pending: { issued_at: null, paid_at: null },
    issued: { issued_at: new Date().toISOString(), paid_at: null },
    paid: { paid_at: new Date().toISOString() },
    skipped: { issued_at: null, paid_at: null },
  }[parsed.data.status];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("billing_installments")
    .update({ status: parsed.data.status, ...stamps } as never)
    .eq("id", parsed.data.installmentId)
    .eq("org_id", context.orgId)
    .select("id");

  if (error) return { ok: false, error: `Mise à jour refusée : ${error.message}` };
  if (!data || data.length === 0) {
    return { ok: false, error: "Échéance introuvable." };
  }

  refresh();
  return { ok: true, message: "Échéance mise à jour." };
}

// --- Terminer un engagement --------------------------------------------------

const endEngagementInput = z.object({ engagementId: z.uuid() });

/**
 * Clore un engagement : résiliation, fin anticipée. Ses échéances encore à
 * émettre passent « passées » — les émises et payées, elles, sont de
 * l'histoire et ne bougent pas.
 */
export async function endEngagement(
  _previous: BillingActionResult | null,
  formData: FormData,
): Promise<BillingActionResult> {
  const parsed = endEngagementInput.safeParse({
    engagementId: formData.get("engagementId"),
  });
  if (!parsed.success) return { ok: false, error: "Requête incomplète." };

  const context = await requireFinanceAccess();
  if (!context.canDecide) return { ok: false, error: "Action indisponible." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("billing_engagements")
    .update({ status: "ended" } as never)
    .eq("id", parsed.data.engagementId)
    .eq("org_id", context.orgId);
  if (error) return { ok: false, error: `Clôture refusée : ${error.message}` };

  const { error: linesError } = await supabase
    .from("billing_installments")
    .update({ status: "skipped" } as never)
    .eq("engagement_id", parsed.data.engagementId)
    .eq("org_id", context.orgId)
    .eq("status", "pending");
  if (linesError) {
    return { ok: false, error: `Clôture partielle : ${linesError.message}` };
  }

  refresh();
  return { ok: true, message: "Engagement terminé, échéances restantes passées." };
}

// --- Supprimer un engagement -------------------------------------------------

const deleteEngagementInput = z.object({ engagementId: z.uuid() });

/**
 * Suppression réelle, réservée à l'erreur de saisie : l'engagement part avec
 * toutes ses échéances, émises comprises (cascade). Pour une fin de contrat,
 * c'est `endEngagement` — l'historique de ce qui a été facturé se garde.
 */
export async function deleteEngagement(
  _previous: BillingActionResult | null,
  formData: FormData,
): Promise<BillingActionResult> {
  const parsed = deleteEngagementInput.safeParse({
    engagementId: formData.get("engagementId"),
  });
  if (!parsed.success) return { ok: false, error: "Requête incomplète." };

  const context = await requireFinanceAccess();
  if (!context.canDecide) return { ok: false, error: "Action indisponible." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("billing_engagements")
    .delete()
    .eq("id", parsed.data.engagementId)
    .eq("org_id", context.orgId);
  if (error) return { ok: false, error: `Suppression refusée : ${error.message}` };

  refresh();
  return { ok: true, message: "Engagement supprimé avec ses échéances." };
}
